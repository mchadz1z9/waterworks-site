import json
from datetime import date
from dateutil.relativedelta import relativedelta

from django.shortcuts import render, get_object_or_404, redirect
from django.views import View
from django.views.generic import ListView, CreateView, DetailView
from django.contrib import messages
from django.urls import reverse

from .models import Scenario, InvestmentPeriod, InterestRate, CalculationResult
from .forms import ScenarioForm, InvestmentPeriodFormSet, InterestRateForm
from .engine.aggregator import run_full_calculation
from .engine.interest_calc import TERM_BUCKETS, DEFAULT_RATES


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


class InvestmentScheduleView(View):
    """
    Per-month investment amounts table — the core 'different amounts at different times' feature.
    """
    template_name = 'calculator/schedule.html'

    def _get_formset(self, scenario, data=None):
        qs = InvestmentPeriod.objects.filter(scenario=scenario).order_by('month')
        return InvestmentPeriodFormSet(
            data,
            queryset=qs,
            scenario=scenario,
            prefix='periods',
        )

    def _month_dates(self, scenario):
        """Generate a date for each month row."""
        dates = {}
        d = scenario.start_date
        for m in range(1, 61):
            dates[m] = d
            d = (d + relativedelta(months=1)).replace(day=1)
        return dates

    def get(self, request, pk):
        scenario = get_object_or_404(Scenario, pk=pk)
        formset = self._get_formset(scenario)
        return render(request, self.template_name, {
            'scenario': scenario,
            'formset': formset,
            'month_dates': self._month_dates(scenario),
        })

    def post(self, request, pk):
        scenario = get_object_or_404(Scenario, pk=pk)
        formset = self._get_formset(scenario, request.POST)
        if formset.is_valid():
            formset.save()
            messages.success(request, 'Investment schedule saved.')
            return redirect('calculator:rates', pk=pk)
        return render(request, self.template_name, {
            'scenario': scenario,
            'formset': formset,
            'month_dates': self._month_dates(scenario),
        })


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
