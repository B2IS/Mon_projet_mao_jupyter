from rest_framework import serializers
from .models import SiteProjet, HeartbeatTemps, PingGeo


class SiteProjetSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteProjet
        fields = '__all__'


class HeartbeatSerializer(serializers.ModelSerializer):
    class Meta:
        model = HeartbeatTemps
        fields = '__all__'
        read_only_fields = ['utilisateur', 'horodatage']


class PingGeoSerializer(serializers.ModelSerializer):
    class Meta:
        model = PingGeo
        fields = '__all__'
        read_only_fields = ['utilisateur', 'site', 'projet', 'distance_m', 'dans_geofence', 'horodatage']
