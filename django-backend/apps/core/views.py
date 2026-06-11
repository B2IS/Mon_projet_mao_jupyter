from rest_framework import viewsets, permissions
from rest_framework_simplejwt.views import TokenObtainPairView
from drf_spectacular.utils import extend_schema, extend_schema_view
from .models import Utilisateur, Organisation
from .serializers import UtilisateurSerializer, OrganisationSerializer, SIGEPPTokenSerializer


class SIGEPPTokenView(TokenObtainPairView):
    """Login — retourne access + refresh JWT enrichis."""
    serializer_class = SIGEPPTokenSerializer


@extend_schema_view(
    list=extend_schema(tags=['auth'], summary='Liste des utilisateurs'),
    retrieve=extend_schema(tags=['auth'], summary='Détail utilisateur'),
)
class UtilisateurViewSet(viewsets.ReadOnlyModelViewSet):
    queryset           = Utilisateur.objects.filter(is_active=True)
    serializer_class   = UtilisateurSerializer
    permission_classes = [permissions.IsAuthenticated]
    search_fields      = ['nom', 'prenom', 'email', 'role']
    filterset_fields   = ['role', 'direction']


class OrganisationViewSet(viewsets.ReadOnlyModelViewSet):
    queryset           = Organisation.objects.filter(actif=True)
    serializer_class   = OrganisationSerializer
    permission_classes = [permissions.IsAuthenticated]
