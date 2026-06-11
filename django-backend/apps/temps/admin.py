from django.contrib import admin
from .models import SiteProjet, HeartbeatTemps, PingGeo


@admin.register(SiteProjet)
class SiteProjetAdmin(admin.ModelAdmin):
    list_display = ('projet', 'libelle', 'latitude', 'longitude', 'rayon_m')
    search_fields = ('projet', 'libelle')


@admin.register(HeartbeatTemps)
class HeartbeatAdmin(admin.ModelAdmin):
    list_display = ('utilisateur', 'projet', 'secondes', 'source', 'horodatage')
    list_filter = ('source', 'projet')


@admin.register(PingGeo)
class PingGeoAdmin(admin.ModelAdmin):
    list_display = ('utilisateur', 'projet', 'distance_m', 'dans_geofence', 'duree_min', 'horodatage')
    list_filter = ('dans_geofence',)
