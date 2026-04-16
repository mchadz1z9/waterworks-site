from django import forms
from django.forms import modelformset_factory, BaseModelFormSet
from .models import Scenario, InvestmentPeriod, InterestRate
from .engine.interest_calc import DEFAULT_RATES, TERM_BUCKETS


class ScenarioForm(forms.ModelForm):
    class Meta:
        model = Scenario
        fields = ['name', 'start_capital', 'start_date']
        widgets = {
            'start_date': forms.DateInput(attrs={'type': 'date'}),
            'start_capital': forms.NumberInput(attrs={'step': '0.01', 'min': '0'}),
        }
        labels = {
            'start_capital': 'Starting Capital ($)',
        }


class InvestmentPeriodForm(forms.ModelForm):
    class Meta:
        model = InvestmentPeriod
        fields = ['month', 'new_investment', 'growth_pct', 'new_growth_pct']
        widgets = {
            'month': forms.HiddenInput(),
            'new_investment': forms.NumberInput(attrs={
                'step': '0.01', 'min': '0', 'class': 'inv-input',
                'placeholder': '0.00',
            }),
            'growth_pct': forms.NumberInput(attrs={
                'step': '0.001', 'min': '0', 'max': '1', 'class': 'pct-input',
                'placeholder': '0.000',
            }),
            'new_growth_pct': forms.NumberInput(attrs={
                'step': '0.001', 'min': '0', 'max': '1', 'class': 'pct-input',
                'placeholder': '0.000',
            }),
        }


class BaseInvestmentPeriodFormSet(BaseModelFormSet):
    def __init__(self, *args, scenario=None, **kwargs):
        self.scenario = scenario
        super().__init__(*args, **kwargs)

    def save(self, commit=True):
        instances = super().save(commit=False)
        for instance in instances:
            instance.scenario = self.scenario
            if commit:
                instance.save()
        return instances


InvestmentPeriodFormSet = modelformset_factory(
    InvestmentPeriod,
    form=InvestmentPeriodForm,
    formset=BaseInvestmentPeriodFormSet,
    extra=0,
    can_delete=False,
)


class InterestRateForm(forms.Form):
    """Single form with one field per term bucket."""

    def __init__(self, *args, initial_rates=None, **kwargs):
        super().__init__(*args, **kwargs)
        for term in TERM_BUCKETS:
            label = self._term_label(term)
            default = initial_rates.get(term, DEFAULT_RATES[term]) if initial_rates else DEFAULT_RATES[term]
            self.fields[f'rate_{term}'] = forms.DecimalField(
                label=f'{label} Annual Rate',
                initial=round(default * 100, 4),
                min_value=0,
                max_value=100,
                decimal_places=4,
                widget=forms.NumberInput(attrs={
                    'step': '0.0001', 'class': 'rate-input',
                    'placeholder': f'{default * 100:.4f}',
                }),
                help_text='Enter as percentage (e.g. 4.5 for 4.5%)',
            )

    def _term_label(self, months):
        if months < 12:
            return f'{months}M'
        elif months == 12:
            return '1Y'
        elif months % 12 == 0:
            return f'{months // 12}Y'
        return f'{months}M'

    def get_rate_dict(self):
        """Return {term_months: annual_rate_decimal} from cleaned data."""
        return {
            term: float(self.cleaned_data[f'rate_{term}']) / 100
            for term in TERM_BUCKETS
        }
