from rest_framework import viewsets, permissions
from .models import LigneBudget, Decaissement
from .serializers import LigneBudgetSerializer, DecaissementSerializer


class LigneBudgetViewSet(viewsets.ModelViewSet):
    queryset           = LigneBudget.objects.select_related('projet').all()
    serializer_class   = LigneBudgetSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields   = ['projet', 'nature', 'exercice']
    search_fields      = ['libelle', 'projet__code']


class DecaissementViewSet(viewsets.ModelViewSet):
    queryset           = Decaissement.objects.select_related('ligne_budget', 'validateur').all()
    serializer_class   = DecaissementSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields   = ['statut', 'ligne_budget__projet']
