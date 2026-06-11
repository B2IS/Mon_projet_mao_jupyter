from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import LigneBudgetViewSet, DecaissementViewSet

router = DefaultRouter()
router.register('budget/lignes',       LigneBudgetViewSet)
router.register('budget/decaissements', DecaissementViewSet)

urlpatterns = [path('', include(router.urls))]
