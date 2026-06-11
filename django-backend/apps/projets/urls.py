from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProgrammeViewSet, ProjetViewSet, JalonViewSet, TacheViewSet

router = DefaultRouter()
router.register('programmes', ProgrammeViewSet)
router.register('projets',    ProjetViewSet)
router.register('jalons',     JalonViewSet)
router.register('taches',     TacheViewSet)

urlpatterns = [path('', include(router.urls))]
