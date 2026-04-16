"""
interest_calc.py
Converts annual rates to monthly and computes interest earned.
Replaces the Bloomberg_Monthly external data feed from the Excel workbook.
"""

# Default annual rates per term bucket (15 maturity buckets from the workbook).
# Users can override these per-scenario via the InterestRate model.
TERM_BUCKETS = [1, 2, 3, 6, 12, 24, 36, 48, 60, 72, 84, 96, 108, 120, 180]

DEFAULT_RATES = {
    1: 0.0450,
    2: 0.0455,
    3: 0.0460,
    6: 0.0470,
    12: 0.0480,
    24: 0.0490,
    36: 0.0500,
    48: 0.0510,
    60: 0.0520,
    72: 0.0530,
    84: 0.0540,
    96: 0.0545,
    108: 0.0550,
    120: 0.0555,
    180: 0.0560,
}


def annualized_to_monthly(annual_rate: float) -> float:
    """Convert an annual rate to a monthly rate (simple division, matching workbook logic)."""
    return annual_rate / 12


def compute_interest(balance: float, monthly_rate: float, months: int) -> float:
    """Compute simple interest: balance * monthly_rate * months."""
    return balance * monthly_rate * months


def build_rate_map(user_rates: dict | None = None) -> dict:
    """
    Return a dict of {term_months: monthly_rate}.
    user_rates should be {term_months: annual_rate}.
    Falls back to DEFAULT_RATES for any missing bucket.
    """
    rate_map = {}
    for term in TERM_BUCKETS:
        if user_rates and term in user_rates:
            annual = float(user_rates[term])
        else:
            annual = DEFAULT_RATES[term]
        rate_map[term] = annualized_to_monthly(annual)
    return rate_map
