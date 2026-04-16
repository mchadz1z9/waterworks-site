"""
aggregator.py
Replicates the Combined sheet from Matrix_Calcs_3.00.xlsm.

Named output ranges replicated:
  BalanceOutput          → Combined!I9:AK33    (25x25)
  InterestOutput         → Combined!J41:AK65   (25x25)
  BalanceBreakDownOutput → Combined!AP9:AX33   (25x15)
  InterestBreakdownOutput→ Combined!AP41:AX65  (25x15)
"""

import numpy as np
from .interest_calc import TERM_BUCKETS
from .balance_matrix import build_all_matrices
from .capital_schedule import run_capital_schedule


def aggregate_outputs(matrices: dict) -> dict:
    """
    Sum all variant balance and interest matrices into the 4 output ranges.

    Args:
        matrices: Output of build_all_matrices()

    Returns:
        {
            'balance_output': 25x25 np.ndarray,       # BalanceOutput
            'interest_output': 25x25 np.ndarray,      # InterestOutput
            'balance_breakdown': 25x15 np.ndarray,    # BalanceBreakDownOutput
            'interest_breakdown': 25x15 np.ndarray,   # InterestBreakdownOutput
            'row_totals_balance': list[float],         # row sums for balance
            'row_totals_interest': list[float],        # row sums for interest
            'col_totals_balance': list[float],         # column sums for balance
            'col_totals_interest': list[float],        # column sums for interest
            'grand_total_balance': float,
            'grand_total_interest': float,
            'term_buckets': list[int],
        }
    """
    # Sum all variant balance matrices
    total_balance = np.zeros((26, 26), dtype=float)
    total_interest = np.zeros((26, 26), dtype=float)

    for variant_data in matrices.values():
        total_balance += variant_data['balance']
        total_interest += variant_data['interest']

    # Trim to 25x25 for BalanceOutput / InterestOutput (rows 1-25, cols 0-24)
    balance_output = total_balance[1:26, :25]
    interest_output = total_interest[1:26, :25]

    # Breakdown: 25 rows x 15 term buckets
    balance_breakdown = total_balance[1:26, :15]
    interest_breakdown = total_interest[1:26, :15]

    return {
        'balance_output': balance_output.tolist(),
        'interest_output': interest_output.tolist(),
        'balance_breakdown': balance_breakdown.tolist(),
        'interest_breakdown': interest_breakdown.tolist(),
        'row_totals_balance': balance_output.sum(axis=1).tolist(),
        'row_totals_interest': interest_output.sum(axis=1).tolist(),
        'col_totals_balance': balance_output.sum(axis=0).tolist(),
        'col_totals_interest': interest_output.sum(axis=0).tolist(),
        'grand_total_balance': float(balance_output.sum()),
        'grand_total_interest': float(interest_output.sum()),
        'term_buckets': TERM_BUCKETS[:25],
    }


def run_full_calculation(
    start_capital: float,
    start_date,
    periods: list[dict],
    user_rates: dict | None = None,
    rate_mode: str = 'bloomberg',
    scenario=None,
) -> dict:
    """
    End-to-end calculation: schedule → matrices → aggregation.

    rate_mode:
      'bloomberg' — use real CDS rates from BloombergRate table
      'custom'    — use user_rates dict {term_months: annual_rate}
      'forecast'  — blend Bloomberg history + scenario ForecastRate rows
    """
    from .interest_calc import (
        build_rate_map,
        build_rate_map_from_bloomberg,
        build_rate_map_from_forecast,
    )

    schedule = run_capital_schedule(start_capital, start_date, periods)
    num_months = len(schedule)

    if rate_mode == 'bloomberg':
        rate_map = build_rate_map_from_bloomberg(start_date)
    elif rate_mode == 'forecast' and scenario is not None:
        rate_map = build_rate_map_from_forecast(scenario, start_date, num_months)
    else:
        rate_map = build_rate_map(user_rates)

    matrices = build_all_matrices(schedule, rate_map)
    outputs = aggregate_outputs(matrices)

    # Summary stats from schedule
    total_invested = schedule[-1]['total_invested'] if schedule else 0
    final_balance = schedule[-1]['cumulative_balance'] if schedule else 0
    total_new_investments = sum(r['new_investment'] for r in schedule)

    return {
        'schedule': [
            {**r, 'date': r['date'].isoformat()}
            for r in schedule
        ],
        'summary': {
            'start_capital': start_capital,
            'total_new_investments': total_new_investments,
            'total_invested': total_invested,
            'final_balance': final_balance,
            'total_interest': outputs['grand_total_interest'],
            'grand_total_balance': outputs['grand_total_balance'],
        },
        **outputs,
    }
