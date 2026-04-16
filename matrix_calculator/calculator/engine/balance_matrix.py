"""
balance_matrix.py
Replicates the 6 capital variant sheets from Matrix_Calcs_3.00.xlsm:
  - Existing Cap  (5, 7, 10 year)
  - New Growth    (5, 7, 10 year)
  - Drawdown Cap  (7, 10 year)

Each variant produces a 26x26 balance matrix and a 26x26 interest matrix.
Rows = investment cohort (month entered), Cols = time period bucket.
"""

import numpy as np
from .interest_calc import TERM_BUCKETS, compute_interest


TERM_YEARS_TO_MONTHS = {5: 60, 7: 84, 10: 120}


def _allocation_fraction(term_years: int) -> float:
    """
    Fraction of capital allocated to this term bucket.
    Existing cap splits roughly equally across active term sheets.
    """
    fractions = {5: 0.20, 7: 0.40, 10: 0.40}
    return fractions.get(term_years, 0.33)


def build_balance_matrix(
    schedule_rows: list[dict],
    term_years: int,
    capital_type: str = 'existing',
) -> np.ndarray:
    """
    Build a 26x26 balance matrix.

    Rows (0-25): investment cohort months (month 0 = start capital, months 1-25 = period 1-25)
    Cols (0-25): time period buckets corresponding to TERM_BUCKETS (first 15 used, rest zero)

    Args:
        schedule_rows: Output of run_capital_schedule()
        term_years: 5, 7, or 10
        capital_type: 'existing', 'new_growth', or 'drawdown'

    Returns:
        26x26 numpy array of balances
    """
    matrix = np.zeros((26, 26), dtype=float)
    term_months = TERM_YEARS_TO_MONTHS.get(term_years, 84)
    alloc = _allocation_fraction(term_years)

    for i, row in enumerate(schedule_rows[:25]):
        if capital_type == 'existing':
            base = row['starting_cap'] * alloc
        elif capital_type == 'new_growth':
            base = row['new_investment'] * alloc
        elif capital_type == 'drawdown':
            base = row['drawdown'] * alloc
        else:
            base = 0.0

        if base == 0:
            continue

        # Distribute balance across term buckets that fall within term_months
        for j, bucket in enumerate(TERM_BUCKETS[:26]):
            if bucket <= term_months:
                # Balance decays linearly as we approach maturity
                remaining_fraction = max(0, 1 - bucket / term_months)
                matrix[i][j] = base * remaining_fraction

    return matrix


def build_interest_matrix(
    balance_matrix: np.ndarray,
    rate_map: dict,
) -> np.ndarray:
    """
    Compute interest earned: interest[i][j] = balance[i][j] * monthly_rate[j] * term_months[j]

    Args:
        balance_matrix: 26x26 balance array from build_balance_matrix()
        rate_map: {term_months: monthly_rate} from build_rate_map()

    Returns:
        26x26 numpy array of interest earned
    """
    interest = np.zeros_like(balance_matrix)
    for j, bucket in enumerate(TERM_BUCKETS[:26]):
        monthly_rate = rate_map.get(bucket, 0)
        interest[:, j] = balance_matrix[:, j] * monthly_rate * bucket
    return interest


def build_all_matrices(schedule_rows: list[dict], rate_map: dict) -> dict:
    """
    Build all 6 variant matrix pairs (balance + interest) matching the workbook structure.

    Returns dict with keys:
        existing_5, existing_7, existing_10,
        new_growth_5, new_growth_7, new_growth_10,
        drawdown_7, drawdown_10
    Each value: {'balance': np.ndarray, 'interest': np.ndarray}
    """
    result = {}
    variants = [
        ('existing', 5), ('existing', 7), ('existing', 10),
        ('new_growth', 5), ('new_growth', 7), ('new_growth', 10),
        ('drawdown', 7), ('drawdown', 10),
    ]
    for cap_type, years in variants:
        key = f'{cap_type}_{years}'
        bal = build_balance_matrix(schedule_rows, years, cap_type)
        result[key] = {
            'balance': bal,
            'interest': build_interest_matrix(bal, rate_map),
        }
    return result
