"""services.py — Matching géographique (miroir de lib/tempsStore.ts)."""
from math import radians, sin, cos, asin, sqrt
from .models import SiteProjet


def haversine_m(lat1, lng1, lat2, lng2):
    R = 6_371_000
    d_lat, d_lng = radians(lat2 - lat1), radians(lng2 - lng1)
    a = sin(d_lat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(d_lng / 2) ** 2
    return 2 * R * asin(sqrt(a))


def match_site(lat, lng):
    """Site projet le plus proche + statut géofence."""
    best, best_d = None, float('inf')
    for s in SiteProjet.objects.all():
        d = haversine_m(lat, lng, s.latitude, s.longitude)
        if d < best_d:
            best, best_d = s, d
    return {
        'site': best,
        'distance_m': int(best_d) if best else 0,
        'dans_geofence': bool(best) and best_d <= best.rayon_m,
    }
