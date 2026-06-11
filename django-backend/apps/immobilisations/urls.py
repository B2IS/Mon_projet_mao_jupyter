from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ActifImmobiliseViewSet, PVReceptionViewSet

router = DefaultRouter()
router.register('immobilisations/actifs', ActifImmobiliseViewSet)
router.register('immobilisations/pv',     PVReceptionViewSet)

urlpatterns = [path('', include(router.urls))]
