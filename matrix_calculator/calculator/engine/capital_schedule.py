"""
capital_schedule.py
Replicates the Capital Schedule sheet (A1:AY57) from Matrix_Calcs_3.00.xlsm.

Key Excel formulas translated:
  Monthly rate:      =1/60 * F2          → rate = start_capital / 60
  Running balance:   =G8+SUM($H$8:I8)    → cumulative sum of investments
  Drawdown:          =MAX(D8-D9, 0)      → max(prev_balance - curr_balance, 0)
  Period count:      =IF(I8=0,0,COUNTIFS($I$8:I8,">0"))  → count of non-zero investment periods
  Date:              =EOMONTH(F8, 1)     → add 1 month
"""

from datetime import date
from dateutil.relativedelta import relativedelta


def _end_of_month(d: date) -> date:
    """Return the last day of the month that is one month after d."""
    next_month = d + relativedelta(months=1)
    return next_month.replace(day=1) - relativedelta(days=1)


def run_capital_schedule(
    start_capital: float,
    start_date: date,
    periods: list[dict],
) -> list[dict]:
    """
    Run the monthly capital schedule for up to 60 periods.

    Args:
        start_capital: Initial capital amount (F2 in the workbook).
        start_date: Schedule start date (G8 in the workbook).
        periods: List of dicts, one per month:
            {
                'month': int (1-based),
                'new_investment': float,   # additional capital injected this month
                'growth_pct': float,       # existing cap growth rate (decimal, e.g. 0.02)
                'new_growth_pct': float,   # new cap growth rate
            }
            Missing months default to 0 / 0.0.

    Returns:
        List of row dicts (one per month):
            {
                'month': int,
                'date': date,
                'starting_cap': float,
                'growth': float,
                'new_investment': float,
                'new_growth': float,
                'total_invested': float,
                'cumulative_balance': float,
                'drawdown': float,
                'active_periods': int,
                'monthly_rate': float,
            }
    """
    # Build a lookup from month number to period params
    period_map = {p['month']: p for p in periods}
    num_months = max((p['month'] for p in periods), default=60)
    num_months = min(max(num_months, 1), 60)

    # Monthly rate from start capital (workbook: =1/60*F2)
    monthly_rate = start_capital / 60 if start_capital else 0

    rows = []
    cumulative_balance = start_capital
    current_date = start_date
    investments_so_far = []  # track all new_investment amounts to date

    for m in range(1, num_months + 1):
        p = period_map.get(m, {})
        new_investment = float(p.get('new_investment', 0))
        growth_pct = float(p.get('growth_pct', 0))
        new_growth_pct = float(p.get('new_growth_pct', 0))

        starting_cap = cumulative_balance
        growth = starting_cap * growth_pct
        new_growth = new_investment * new_growth_pct

        investments_so_far.append(new_investment)
        total_invested = start_capital + sum(investments_so_far)

        prev_balance = cumulative_balance
        cumulative_balance = total_invested + growth
        drawdown = max(prev_balance - cumulative_balance, 0)

        active_periods = sum(1 for x in investments_so_far if x > 0)

        rows.append({
            'month': m,
            'date': current_date,
            'starting_cap': starting_cap,
            'growth': growth,
            'new_investment': new_investment,
            'new_growth': new_growth,
            'total_invested': total_invested,
            'cumulative_balance': cumulative_balance,
            'drawdown': drawdown,
            'active_periods': active_periods,
            'monthly_rate': monthly_rate,
        })

        current_date = _end_of_month(current_date)

    return rows
