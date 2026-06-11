from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SiteProjetViewSet, heartbeat, ping, repartition

router = DefaultRouter()
router.register('temps/sites', SiteProjetViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('temps/heartbeat/', heartbeat),
    path('temps/ping/', ping),
    path('temps/repartition/', repartition),
]
