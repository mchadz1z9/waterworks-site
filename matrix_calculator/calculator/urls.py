from django.urls import path
from . import views

app_name = 'calculator'

urlpatterns = [
    path('', views.ScenarioListView.as_view(), name='index'),
    path('new/', views.ScenarioCreateView.as_view(), name='create'),
    path('<int:pk>/schedule/', views.InvestmentScheduleView.as_view(), name='schedule'),
    path('<int:pk>/rates/', views.RatesView.as_view(), name='rates'),
    path('<int:pk>/run/', views.RunCalculationView.as_view(), name='run'),
    path('<int:pk>/results/', views.ResultsView.as_view(), name='results'),
    path('<int:pk>/results/<int:result_id>/', views.ResultsView.as_view(), name='results_detail'),
    path('compare/', views.CompareView.as_view(), name='compare'),
]
