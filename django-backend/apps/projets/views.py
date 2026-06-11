from rest_framework import viewsets, permissions, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, extend_schema_view
from .models import Programme, Projet, Jalon, Tache
from .serializers import (
    ProgrammeSerializer, ProjetListSerializer,
    ProjetDetailSerializer, JalonSerializer, TacheSerializer,
)


class ProgrammeViewSet(viewsets.ModelViewSet):
    queryset           = Programme.objects.all()
    serializer_class   = ProgrammeSerializer
    permission_classes = [permissions.IsAuthenticated]
    search_fields      = ['code', 'libelle']
    ordering_fields    = ['code', 'created_at']


class ProjetViewSet(viewsets.ModelViewSet):
    queryset           = Projet.objects.select_related('chef_projet', 'programme').all()
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields   = ['statut', 'priorite', 'direction', 'departement', 'chef_projet']
    search_fields      = ['code', 'libelle', 'description']
    ordering_fields    = ['code', 'statut', 'avancement', 'updated_at']

    def get_serializer_class(self):
        if self.action in ('retrieve',):
            return ProjetDetailSerializer
        return ProjetListSerializer

    @extend_schema(summary='KPIs portefeuille', tags=['projets'])
    @action(detail=False, methods=['get'], url_path='kpis')
    def kpis(self, request):
        qs = self.get_queryset()
        from django.db.models import Avg, Sum, Count
        data = qs.aggregate(
            total=Count('id'),
            en_cours=Count('id', filter=__import__('django.db.models', fromlist=['Q']).Q(statut='en_cours')),
            critiques=Count('id', filter=__import__('django.db.models', fromlist=['Q']).Q(statut='critique')),
            avancement_moyen=Avg('avancement'),
            budget_total=Sum('budget_revise'),
            montant_engage=Sum('montant_engage'),
            montant_paye=Sum('montant_paye'),
        )
        return Response(data)


class JalonViewSet(viewsets.ModelViewSet):
    queryset           = Jalon.objects.select_related('projet').all()
    serializer_class   = JalonSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields   = ['projet', 'atteint', 'critique']


class TacheViewSet(viewsets.ModelViewSet):
    queryset           = Tache.objects.select_related('projet', 'responsable').all()
    serializer_class   = TacheSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields   = ['projet', 'statut', 'priorite', 'responsable']
    search_fields      = ['libelle']
