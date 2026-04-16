from django.contrib import admin
from .models import Scenario, InvestmentPeriod, InterestRate, CalculationResult


class InvestmentPeriodInline(admin.TabularInline):
    model = InvestmentPeriod
    extra = 0


class InterestRateInline(admin.TabularInline):
    model = InterestRate
    extra = 0


@admin.register(Scenario)
class ScenarioAdmin(admin.ModelAdmin):
    list_display = ['name', 'start_capital', 'start_date', 'created_at']
    inlines = [InvestmentPeriodInline, InterestRateInline]


@admin.register(CalculationResult)
class CalculationResultAdmin(admin.ModelAdmin):
    list_display = ['scenario', 'calculated_at']
    readonly_fields = ['result_json']
