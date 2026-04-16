"""
interest_calc.py
Rate source helpers for the three rate modes:
  bloomberg  — use the BloombergRate row nearest to the scenario start date
  custom     — use user-supplied InterestRate rows
  forecast   — blend Bloomberg history with user ForecastRate rows,
               averaging rates over the scenario period
"""

TERM_BUCKETS = [1, 2, 3, 6, 12, 24, 36, 48, 60, 72, 84, 96, 108, 120, 180]

TERM_TO_FIELD = {
    1: 'rate_1m', 2: 'rate_2m', 3: 'rate_3m', 6: 'rate_6m',
    12: 'rate_12m', 24: 'rate_24m', 36: 'rate_36m', 48: 'rate_48m',
    60: 'rate_60m', 72: 'rate_72m', 84: 'rate_84m', 96: 'rate_96m',
    108: 'rate_108m', 120: 'rate_120m', 180: 'rate_180m',
}

# Fallback defaults (used only if Bloomberg data is missing for a term)
DEFAULT_RATES = {
    1: 0.0450, 2: 0.0455, 3: 0.0460, 6: 0.0470, 12: 0.0480,
    24: 0.0490, 36: 0.0500, 48: 0.0510, 60: 0.0520, 72: 0.0530,
    84: 0.0540, 96: 0.0545, 108: 0.0550, 120: 0.0555, 180: 0.0560,
}


def annualized_to_monthly(annual_rate: float) -> float:
    return annual_rate / 12


def compute_interest(balance: float, monthly_rate: float, months: int) -> float:
    return balance * monthly_rate * months


def build_rate_map(user_rates: dict | None = None) -> dict:
    """Custom mode: {term_months: monthly_rate} from user-supplied annual rates."""
    rate_map = {}
    for term in TERM_BUCKETS:
        if user_rates and term in user_rates:
            annual = float(user_rates[term])
        else:
            annual = DEFAULT_RATES[term]
        rate_map[term] = annual / 12
    return rate_map


def build_rate_map_from_bloomberg(scenario_start_date) -> dict:
    """
    Bloomberg mode: pick the BloombergRate row whose date is closest to (but
    not after) scenario_start_date. Falls back to most-recent row if none found.
    Converts annual % → monthly decimal (÷ 1200).
    """
    from calculator.models import BloombergRate

    qs = BloombergRate.objects.filter(date__lte=scenario_start_date).order_by('-date')
    row = qs.first()
    if row is None:
        # Scenario starts before all Bloomberg data — use oldest
        row = BloombergRate.objects.order_by('date').first()
    if row is None:
        return build_rate_map()  # fallback to defaults

    rate_map = {}
    for term, field in TERM_TO_FIELD.items():
        val = getattr(row, field)
        if val is not None:
            rate_map[term] = float(val) / 1200
        else:
            rate_map[term] = DEFAULT_RATES[term] / 12
    return rate_map


def build_rate_map_from_forecast(scenario, scenario_start_date, num_months: int) -> dict:
    """
    Forecast mode: build a per-term average rate across all months in the
    scenario period, using Bloomberg history for past months and ForecastRate
    rows for future months.

    Strategy:
      For each month in [0 .. num_months-1]:
        - If a ForecastRate exists for that calendar month → use it
        - Else look up the Bloomberg row for that month (or nearest earlier)
        - Forward-fill the last known rate for months beyond both data sources

    Returns the time-averaged {term: monthly_rate} dict.
    """
    from calculator.models import BloombergRate, ForecastRate
    from dateutil.relativedelta import relativedelta

    bloomberg_rows = {r.date: r for r in BloombergRate.objects.all()}
    forecast_rows  = {r.date: r for r in scenario.forecast_rates.all()}

    # Build sorted bloomberg date list for nearest-neighbour lookup
    bloomberg_dates = sorted(bloomberg_rows.keys())

    # For each term, collect monthly rates across the scenario period
    term_rates = {term: [] for term in TERM_BUCKETS}

    for i in range(num_months):
        month_date = (scenario_start_date + relativedelta(months=i))
        # Normalise to month-end
        import calendar
        last_day = calendar.monthrange(month_date.year, month_date.month)[1]
        from datetime import date
        month_end = date(month_date.year, month_date.month, last_day)

        # Prefer forecast, then Bloomberg nearest
        if month_end in forecast_rows:
            source = forecast_rows[month_end]
            for term, field in TERM_TO_FIELD.items():
                val = getattr(source, field)
                term_rates[term].append(float(val) / 1200 if val is not None else None)
        else:
            # Find nearest Bloomberg row <= month_end
            bb_date = None
            for d in reversed(bloomberg_dates):
                if d <= month_end:
                    bb_date = d
                    break
            if bb_date is None and bloomberg_dates:
                bb_date = bloomberg_dates[0]

            if bb_date:
                source = bloomberg_rows[bb_date]
                for term, field in TERM_TO_FIELD.items():
                    val = getattr(source, field)
                    term_rates[term].append(float(val) / 1200 if val is not None else None)
            else:
                for term in TERM_BUCKETS:
                    term_rates[term].append(None)

    # Average non-None values per term; fall back to DEFAULT_RATES
    rate_map = {}
    for term in TERM_BUCKETS:
        values = [v for v in term_rates[term] if v is not None]
        if values:
            rate_map[term] = sum(values) / len(values)
        else:
            rate_map[term] = DEFAULT_RATES[term] / 12
    return rate_map
