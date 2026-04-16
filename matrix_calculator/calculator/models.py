from django.db import models
from django.urls import reverse


class Scenario(models.Model):
    name = models.CharField(max_length=200)
    start_capital = models.DecimalField(max_digits=15, decimal_places=2)
    start_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name} (${self.start_capital:,.2f})'

    def get_absolute_url(self):
        return reverse('calculator:schedule', args=[self.pk])


class InvestmentPeriod(models.Model):
    """
    One row per month — directly maps to Scenarios_Input sheet.
    Allows different investment amounts at different times.
    """
    scenario = models.ForeignKey(Scenario, related_name='periods', on_delete=models.CASCADE)
    month = models.PositiveIntegerField()
    new_investment = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    growth_pct = models.DecimalField(max_digits=7, decimal_places=5, default=0)
    new_growth_pct = models.DecimalField(max_digits=7, decimal_places=5, default=0)

    class Meta:
        ordering = ['month']
        unique_together = [['scenario', 'month']]

    def __str__(self):
        return f'Scenario {self.scenario_id} — Month {self.month}'


class InterestRate(models.Model):
    """User-supplied rates per term bucket (replaces Bloomberg feed)."""
    TERM_CHOICES = [
        (1, '1 Month'), (2, '2 Months'), (3, '3 Months'), (6, '6 Months'),
        (12, '1 Year'), (24, '2 Years'), (36, '3 Years'), (48, '4 Years'),
        (60, '5 Years'), (72, '6 Years'), (84, '7 Years'), (96, '8 Years'),
        (108, '9 Years'), (120, '10 Years'), (180, '15 Years'),
    ]
    scenario = models.ForeignKey(Scenario, related_name='rates', on_delete=models.CASCADE)
    term_months = models.PositiveIntegerField(choices=TERM_CHOICES)
    annual_rate = models.DecimalField(max_digits=7, decimal_places=5)

    class Meta:
        ordering = ['term_months']
        unique_together = [['scenario', 'term_months']]

    def __str__(self):
        return f'{self.get_term_months_display()} @ {self.annual_rate * 100:.3f}%'


class CalculationResult(models.Model):
    scenario = models.ForeignKey(Scenario, related_name='results', on_delete=models.CASCADE)
    calculated_at = models.DateTimeField(auto_now_add=True)
    result_json = models.JSONField()

    class Meta:
        ordering = ['-calculated_at']

    def __str__(self):
        return f'Result for {self.scenario} @ {self.calculated_at:%Y-%m-%d %H:%M}'

    @property
    def summary(self):
        return self.result_json.get('summary', {})
