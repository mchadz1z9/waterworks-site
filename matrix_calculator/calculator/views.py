import csv
import io
import json
from datetime import date
from dateutil.relativedelta import relativedelta

from django.shortcuts import render, get_object_or_404, redirect
from django.views import View
from django.views.generic import ListView
from django.contrib import messages
from django.http import HttpResponse
from django.urls import reverse

from .models import (Scenario, InvestmentPeriod, InterestRate,
                     CalculationResult, BloombergRate, ForecastRate,
                     TERM_BUCKETS, TERM_TO_FIELD)
from .forms import ScenarioForm, InterestRateForm
from .engine.aggregator import run_full_calculation
from .engine.interest_calc import DEFAULT_RATES


class ScenarioListView(ListView):
    model = Scenario
    template_name = 'calculator/index.html'
    context_object_name = 'scenarios'

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx['form'] = ScenarioForm()
        return ctx


class ScenarioCreateView(View):
    def post(self, request):
        form = ScenarioForm(request.POST)
        if form.is_valid():
            scenario = form.save()
            # Pre-populate 60 InvestmentPeriod rows
            InvestmentPeriod.objects.bulk_create([
                InvestmentPeriod(scenario=scenario, month=m)
                for m in range(1, 61)
            ])
            # Pre-populate default interest rates
            InterestRate.objects.bulk_create([
                InterestRate(
                    scenario=scenario,
                    term_months=term,
                    annual_rate=DEFAULT_RATES[term],
                )
                for term in TERM_BUCKETS
            ])
            messages.success(request, f'Scenario "{scenario.name}" created.')
            return redirect('calculator:schedule', pk=scenario.pk)
        # Re-render list with errors
        scenarios = Scenario.objects.all()
        return render(request, 'calculator/index.html', {
            'scenarios': scenarios,
            'form': form,
        })


def _month_rows(scenario):
    """Return list of dicts with period data + date for each of 60 months."""
    periods = {p.month: p for p in scenario.periods.all()}
    rows = []
    d = scenario.start_date
    for m in range(1, 61):
        p = periods.get(m)
        rows.append({
            'month': m,
            'date': d,
            'new_investment': float(p.new_investment) if p else 0,
            'growth_pct': float(p.growth_pct) if p else 0,
            'new_growth_pct': float(p.new_growth_pct) if p else 0,
        })
        d = (d + relativedelta(months=1)).replace(day=1)
    return rows


def _save_schedule_from_post(scenario, post_data):
    """Parse month_N_* fields from POST and bulk-update InvestmentPeriod rows."""
    updates = {}
    for m in range(1, 61):
        try:
            inv = float(post_data.get(f'inv_{m}', 0) or 0)
            gpct = float(post_data.get(f'gpct_{m}', 0) or 0)
            ngpct = float(post_data.get(f'ngpct_{m}', 0) or 0)
        except (ValueError, TypeError):
            inv, gpct, ngpct = 0, 0, 0
        updates[m] = (inv, gpct, ngpct)

    periods = {p.month: p for p in scenario.periods.all()}
    to_update = []
    for m, (inv, gpct, ngpct) in updates.items():
        p = periods.get(m)
        if p:
            p.new_investment = inv
            p.growth_pct = gpct
            p.new_growth_pct = ngpct
            to_update.append(p)

    InvestmentPeriod.objects.bulk_update(
        to_update, ['new_investment', 'growth_pct', 'new_growth_pct']
    )


class InvestmentScheduleView(View):
    """Per-month investment amounts — simple flat POST, no formset."""
    template_name = 'calculator/schedule.html'

    def get(self, request, pk):
        scenario = get_object_or_404(Scenario, pk=pk)
        return render(request, self.template_name, {
            'scenario': scenario,
            'rows': _month_rows(scenario),
        })

    def post(self, request, pk):
        scenario = get_object_or_404(Scenario, pk=pk)
        _save_schedule_from_post(scenario, request.POST)
        messages.success(request, 'Investment schedule saved.')
        return redirect('calculator:rates', pk=pk)


class ScheduleUploadView(View):
    """Accept a CSV or Excel file and populate the investment schedule."""

    def post(self, request, pk):
        scenario = get_object_or_404(Scenario, pk=pk)
        f = request.FILES.get('file')
        if not f:
            messages.error(request, 'No file selected.')
            return redirect('calculator:schedule', pk=pk)

        filename = f.name.lower()
        try:
            if filename.endswith('.csv'):
                rows = self._parse_csv(f)
            elif filename.endswith(('.xlsx', '.xls')):
                rows = self._parse_excel(f)
            else:
                messages.error(request, 'Please upload a .csv or .xlsx file.')
                return redirect('calculator:schedule', pk=pk)
        except Exception as e:
            messages.error(request, f'Could not parse file: {e}')
            return redirect('calculator:schedule', pk=pk)

        # Build fake POST-style dict and save
        post_data = {}
        for row in rows:
            m = int(row.get('month', 0))
            if 1 <= m <= 60:
                post_data[f'inv_{m}'] = row.get('new_investment', 0)
                post_data[f'gpct_{m}'] = row.get('growth_pct', 0)
                post_data[f'ngpct_{m}'] = row.get('new_growth_pct', 0)

        _save_schedule_from_post(scenario, post_data)
        messages.success(request, f'Loaded {len(rows)} rows from {f.name}.')
        return redirect('calculator:schedule', pk=pk)

    def _parse_csv(self, f):
        text = f.read().decode('utf-8-sig')
        reader = csv.DictReader(io.StringIO(text))
        return [self._normalise(r) for r in reader]

    def _parse_excel(self, f):
        import openpyxl
        wb = openpyxl.load_workbook(f, read_only=True, data_only=True)
        ws = wb.active
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            return []
        headers = [str(h).strip().lower().replace(' ', '_') if h else '' for h in rows[0]]
        result = []
        for row in rows[1:]:
            result.append(self._normalise(dict(zip(headers, row))))
        return result

    def _normalise(self, row):
        """Accept flexible column names."""
        def get(*keys):
            for k in keys:
                v = row.get(k)
                if v is not None and v != '':
                    try:
                        return float(str(v).replace(',', '').replace('%', '').strip())
                    except (ValueError, TypeError):
                        pass
            return 0

        return {
            'month': int(get('month', 'month_#', '#', 'mo') or 0),
            'new_investment': get('new_investment', 'investment', 'amount', 'new investment'),
            'growth_pct': get('growth_pct', 'growth_%', 'growth', 'growth_percent'),
            'new_growth_pct': get('new_growth_pct', 'new_growth_%', 'new_growth', 'new_growth_percent'),
        }


class ScheduleTemplateView(View):
    """Download a blank CSV template pre-filled with month numbers and dates."""

    def get(self, request, pk):
        scenario = get_object_or_404(Scenario, pk=pk)
        rows = _month_rows(scenario)

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="schedule_template_{scenario.pk}.csv"'

        writer = csv.writer(response)
        writer.writerow(['month', 'date', 'new_investment', 'growth_pct', 'new_growth_pct'])
        for r in rows:
            writer.writerow([
                r['month'],
                r['date'].strftime('%Y-%m-%d'),
                r['new_investment'] or '',
                r['growth_pct'] or '',
                r['new_growth_pct'] or '',
            ])
        return response


class RatesView(View):
    template_name = 'calculator/rates.html'

    def _initial_rates(self, scenario):
        return {
            r.term_months: float(r.annual_rate)
            for r in scenario.rates.all()
        }

    def get(self, request, pk):
        scenario = get_object_or_404(Scenario, pk=pk)
        form = InterestRateForm(initial_rates=self._initial_rates(scenario))
        return render(request, self.template_name, {
            'scenario': scenario,
            'form': form,
            'term_buckets': TERM_BUCKETS,
        })

    def post(self, request, pk):
        scenario = get_object_or_404(Scenario, pk=pk)
        form = InterestRateForm(request.POST, initial_rates=self._initial_rates(scenario))
        if form.is_valid():
            rate_dict = form.get_rate_dict()
            for term, annual_rate in rate_dict.items():
                InterestRate.objects.update_or_create(
                    scenario=scenario,
                    term_months=term,
                    defaults={'annual_rate': annual_rate},
                )
            messages.success(request, 'Interest rates saved.')
            return redirect('calculator:run', pk=pk)
        return render(request, self.template_name, {
            'scenario': scenario,
            'form': form,
            'term_buckets': TERM_BUCKETS,
        })


class RunCalculationView(View):
    def post(self, request, pk):
        scenario = get_object_or_404(Scenario, pk=pk)
        periods = [
            {
                'month': p.month,
                'new_investment': float(p.new_investment),
                'growth_pct': float(p.growth_pct),
                'new_growth_pct': float(p.new_growth_pct),
            }
            for p in scenario.periods.all()
        ]
        user_rates = {
            r.term_months: float(r.annual_rate)
            for r in scenario.rates.all()
        }
        result = run_full_calculation(
            start_capital=float(scenario.start_capital),
            start_date=scenario.start_date,
            periods=periods,
            user_rates=user_rates,
            rate_mode=scenario.rate_mode,
            scenario=scenario,
        )
        calc = CalculationResult.objects.create(
            scenario=scenario,
            result_json=result,
        )
        return redirect('calculator:results', pk=scenario.pk, result_id=calc.pk)

    def get(self, request, pk):
        # Allow GET to trigger calculation (convenience)
        return self.post(request, pk)


class ResultsView(View):
    template_name = 'calculator/results.html'

    def get(self, request, pk, result_id=None):
        scenario = get_object_or_404(Scenario, pk=pk)
        if result_id:
            calc = get_object_or_404(CalculationResult, pk=result_id, scenario=scenario)
        else:
            calc = scenario.results.first()
            if not calc:
                return redirect('calculator:run', pk=pk)

        result = calc.result_json
        summary = result.get('summary', {})
        schedule = result.get('schedule', [])
        term_buckets = result.get('term_buckets', TERM_BUCKETS[:25])

        # Prepare chart data
        balance_chart = json.dumps({
            'labels': [r['date'] for r in schedule],
            'data': [round(r['cumulative_balance'], 2) for r in schedule],
        })
        interest_chart = json.dumps({
            'labels': [str(t) + 'M' for t in term_buckets[:15]],
            'data': result.get('col_totals_interest', [])[:15],
        })

        return render(request, self.template_name, {
            'scenario': scenario,
            'calc': calc,
            'summary': summary,
            'schedule': schedule,
            'balance_output': result.get('balance_output', []),
            'interest_output': result.get('interest_output', []),
            'balance_breakdown': result.get('balance_breakdown', []),
            'row_totals_balance': result.get('row_totals_balance', []),
            'row_totals_interest': result.get('row_totals_interest', []),
            'col_totals_balance': result.get('col_totals_balance', []),
            'col_totals_interest': result.get('col_totals_interest', []),
            'term_buckets': term_buckets,
            'balance_chart': balance_chart,
            'interest_chart': interest_chart,
        })


class CompareView(View):
    template_name = 'calculator/compare.html'

    def get(self, request):
        scenarios = Scenario.objects.prefetch_related('results').all()
        comparisons = []
        for s in scenarios:
            latest = s.results.first()
            if latest:
                comparisons.append({
                    'scenario': s,
                    'summary': latest.summary,
                    'result_id': latest.pk,
                })
        return render(request, self.template_name, {
            'comparisons': comparisons,
            'scenarios': scenarios,
        })
