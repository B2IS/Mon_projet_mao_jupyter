from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import ActifImmobilise, PVReception
from .serializers import (
    ActifImmobiliseSerializer, PVReceptionSerializer, PlanAmortissementSerializer,
)


class ActifImmobiliseViewSet(viewsets.ModelViewSet):
    queryset           = ActifImmobilise.objects.prefetch_related('lignes', 'pv').all()
    serializer_class   = ActifImmobiliseSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields   = ['famille', 'region', 'departement', 'projet']
    search_fields      = ['code', 'designation', 'feeder']

    @action(detail=True, methods=['get'])
    def amortissement(self, request, pk=None):
        """Plan d'amortissement (consolidé + par article) déclenché par le PV."""
        actif = self.get_object()
        return Response(PlanAmortissementSerializer(actif).data)


class PVReceptionViewSet(viewsets.ModelViewSet):
    queryset           = PVReception.objects.select_related('actif').all()
    serializer_class   = PVReceptionSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields   = ['actif', 'methode']
    search_fields      = ['numero', 'actif__code']
