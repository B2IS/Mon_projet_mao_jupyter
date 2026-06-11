"""views.py — API suivi des temps & présence terrain."""
from django.db.models import Sum
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from .models import SiteProjet, HeartbeatTemps, PingGeo
from .serializers import SiteProjetSerializer, HeartbeatSerializer, PingGeoSerializer
from .services import match_site


def _user(request):
    return request.user if request.user and request.user.is_authenticated else None


class SiteProjetViewSet(viewsets.ModelViewSet):
    queryset = SiteProjet.objects.all()
    serializer_class = SiteProjetSerializer
    permission_classes = [permissions.IsAuthenticated]


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def heartbeat(request):
    """Accumule du temps actif plateforme sur un projet (heartbeat client)."""
    projet = request.data.get('projet', '')
    secondes = int(request.data.get('secondes', 0) or 0)
    HeartbeatTemps.objects.create(utilisateur=_user(request), projet=projet, secondes=secondes)
    return Response({'ok': True}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def ping(request):
    """Enregistre une position GPS, matchée au site projet (haversine + géofence)."""
    lat = float(request.data.get('lat'))
    lng = float(request.data.get('lng'))
    duree = int(request.data.get('duree_min', 0) or 0)
    m = match_site(lat, lng)
    p = PingGeo.objects.create(
        utilisateur=_user(request), latitude=lat, longitude=lng,
        site=m['site'] if m['dans_geofence'] else None,
        projet=(m['site'].projet if m['dans_geofence'] and m['site'] else ''),
        distance_m=m['distance_m'], dans_geofence=m['dans_geofence'], duree_min=duree,
    )
    return Response(PingGeoSerializer(p).data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def repartition(request):
    """Répartition du temps plateforme par projet (à répartir) pour l'utilisateur."""
    qs = HeartbeatTemps.objects.filter(utilisateur=_user(request)) \
        .values('projet').annotate(secondes=Sum('secondes')).order_by('-secondes')
    total = sum(r['secondes'] for r in qs) or 1
    return Response({
        'total_secondes': total,
        'projets': [{'projet': r['projet'], 'secondes': r['secondes'],
                     'pct': round(r['secondes'] / total * 100, 1)} for r in qs],
    })
