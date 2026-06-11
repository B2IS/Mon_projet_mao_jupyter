from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UtilisateurViewSet, OrganisationViewSet, SIGEPPTokenView

router = DefaultRouter()
router.register('utilisateurs',  UtilisateurViewSet)
router.register('organisations', OrganisationViewSet)

urlpatterns = [
    path('auth/login/', SIGEPPTokenView.as_view(), name='sigepp_login'),
    path('', include(router.urls)),
]
