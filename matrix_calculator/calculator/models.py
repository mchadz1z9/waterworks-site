from django.db import models
from django.urls import reverse


RATE_FIELDS = ['rate_1m', 'rate_2m', 'rate_3m', 'rate_6m', 'rate_12m',
               'rate_24m', 'rate_36m', 'rate_48m', 'rate_60m', 'rate_72m',
               'rate_84m', 'rate_96m', 'rate_108m', 'rate_120m', 'rate_180m']

TERM_BUCKETS = [1, 2, 3, 6, 12, 24, 36, 48, 60, 72, 84, 96, 108, 120, 180]

TERM_TO_FIELD = {t: f for t, f in zip(TERM_BUCKETS, RATE_FIELDS)}


def _rate_fields():
    """Return 15 DecimalField definitions for rate columns."""
    return {
        f: models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
        for f in RATE_FIELDS
    }


class BloombergRate(models.Model):
    """
    One row per month of historical CDS rates imported from the Bloomberg_Monthly
    sheet in Matrix_Calcs_3.00.xlsm. Rates stored as annual % (e.g. 4.652).
    """
    date = models.DateField(unique=True)
    rate_1m   = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    rate_2m   = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    rate_3m   = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    rate_6m   = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    rate_12m  = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    rate_24m  = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    rate_36m  = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    rate_48m  = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    rate_60m  = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    rate_72m  = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    rate_84m  = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    rate_96m  = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    rate_108m = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    rate_120m = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    rate_180m = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)

    class Meta:
        ordering = ['date']

    def __str__(self):
        return f'Bloomberg {self.date}'

    def as_rate_map(self):
        """Return {term_months: monthly_rate} for use in the calculation engine."""
        result = {}
        for term, field in TERM_TO_FIELD.items():
            val = getattr(self, field)
            if val is not None:
                result[term] = float(val) / 1200  # annual % → monthly decimal
        return result


class ForecastRate(models.Model):
    """
    User-entered forecast rates for future months (per scenario).
    Extends the Bloomberg historical series forward in time.
    Rates stored as annual % matching Bloomberg convention.
    """
    scenario  = models.ForeignKey('Scenario', related_name='forecast_rates', on_delete=models.CASCADE)
    date      = models.DateField()
    rate_1m   = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    rate_2m   = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    rate_3m   = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    rate_6m   = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    rate_12m  = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    rate_24m  = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    rate_36m  = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    rate_48m  = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    rate_60m  = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    rate_72m  = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    rate_84m  = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    rate_96m  = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    rate_108m = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    rate_120m = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    rate_180m = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)

    class Meta:
        ordering = ['date']
        unique_together = [['scenario', 'date']]

    def __str__(self):
        return f'Forecast {self.date} for {self.scenario}'

    def as_rate_map(self):
        result = {}
        for term, field in TERM_TO_FIELD.items():
            val = getattr(self, field)
            if val is not None:
                result[term] = float(val) / 1200
        return result


class Scenario(models.Model):
    RATE_MODE_CHOICES = [
        ('bloomberg', 'Bloomberg Historical'),
        ('custom',    'Custom Rates'),
        ('forecast',  'Historical + Forecast'),
    ]

    name          = models.CharField(max_length=200)
    start_capital = models.DecimalField(max_digits=15, decimal_places=2)
    start_date    = models.DateField()
    rate_mode     = models.CharField(max_length=20, choices=RATE_MODE_CHOICES, default='bloomberg')
    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name} (${self.start_capital:,.2f})'

    def get_absolute_url(self):
        return reverse('calculator:schedule', args=[self.pk])


class InvestmentPeriod(models.Model):
    scenario       = models.ForeignKey(Scenario, related_name='periods', on_delete=models.CASCADE)
    month          = models.PositiveIntegerField()
    new_investment = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    growth_pct     = models.DecimalField(max_digits=7, decimal_places=5, default=0)
    new_growth_pct = models.DecimalField(max_digits=7, decimal_places=5, default=0)

    class Meta:
        ordering = ['month']
        unique_together = [['scenario', 'month']]

    def __str__(self):
        return f'Scenario {self.scenario_id} — Month {self.month}'


class InterestRate(models.Model):
    """Custom user-supplied rates per term bucket (used when rate_mode == 'custom')."""
    TERM_CHOICES = [
        (1, '1 Month'), (2, '2 Months'), (3, '3 Months'), (6, '6 Months'),
        (12, '1 Year'), (24, '2 Years'), (36, '3 Years'), (48, '4 Years'),
        (60, '5 Years'), (72, '6 Years'), (84, '7 Years'), (96, '8 Years'),
        (108, '9 Years'), (120, '10 Years'), (180, '15 Years'),
    ]
    scenario    = models.ForeignKey(Scenario, related_name='rates', on_delete=models.CASCADE)
    term_months = models.PositiveIntegerField(choices=TERM_CHOICES)
    annual_rate = models.DecimalField(max_digits=7, decimal_places=5)

    class Meta:
        ordering = ['term_months']
        unique_together = [['scenario', 'term_months']]

    def __str__(self):
        return f'{self.get_term_months_display()} @ {float(self.annual_rate):.3f}%'


class CalculationResult(models.Model):
    scenario       = models.ForeignKey(Scenario, related_name='results', on_delete=models.CASCADE)
    calculated_at  = models.DateTimeField(auto_now_add=True)
    result_json    = models.JSONField()

    class Meta:
        ordering = ['-calculated_at']

    def __str__(self):
        return f'Result for {self.scenario} @ {self.calculated_at:%Y-%m-%d %H:%M}'

    @property
    def summary(self):
        return self.result_json.get('summary', {})
