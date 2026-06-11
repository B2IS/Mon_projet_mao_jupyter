"""
apps/temps/models.py — Suivi des temps & présence terrain (RescueTime + Google Maps)
------------------------------------------------------------------------------------
  • SiteProjet     — coordonnées GPS d'un site de projet (géofence).
  • HeartbeatTemps — battement de l'app : temps actif passé par l'utilisateur,
                     accumulé par projet (« temps à répartir »).
  • PingGeo        — position GPS de l'app mobile, matchée au site projet le plus
                     proche (haversine + géofence) ⇒ présence terrain.
"""
from django.db import models
from django.conf import settings


class SiteProjet(models.Model):
    projet   = models.CharField(max_length=200)
    libelle  = models.CharField(max_length=200, blank=True)
    latitude = models.FloatField()
    longitude = models.FloatField()
    rayon_m  = models.PositiveIntegerField(default=3000, help_text='Rayon du géofence (m)')

    class Meta:
        verbose_name = 'Site projet (géofence)'
        ordering = ['projet']

    def __str__(self):
        return f'{self.projet} ({self.latitude:.3f}, {self.longitude:.3f})'


class HeartbeatTemps(models.Model):
    """Temps actif accumulé sur la plateforme, par utilisateur et projet."""
    utilisateur = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name='heartbeats')
    projet   = models.CharField(max_length=200)
    secondes = models.PositiveIntegerField(default=0)
    horodatage = models.DateTimeField(auto_now_add=True)
    source   = models.CharField(max_length=20, default='plateforme')

    class Meta:
        verbose_name = 'Battement de temps'
        ordering = ['-horodatage']
        indexes = [models.Index(fields=['utilisateur', 'projet', 'horodatage'])]

    def __str__(self):
        return f'{self.projet} +{self.secondes}s'


class PingGeo(models.Model):
    utilisateur   = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                      on_delete=models.SET_NULL, related_name='pings_geo')
    latitude      = models.FloatField()
    longitude     = models.FloatField()
    site          = models.ForeignKey(SiteProjet, null=True, blank=True, on_delete=models.SET_NULL, related_name='pings')
    projet        = models.CharField(max_length=200, blank=True)   # site matché si dans le géofence
    distance_m    = models.PositiveIntegerField(default=0)
    dans_geofence = models.BooleanField(default=False)
    duree_min     = models.PositiveIntegerField(default=0)
    horodatage    = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Ping géolocalisé'
        ordering = ['-horodatage']

    def __str__(self):
        return f'{self.projet or "hors site"} · {self.distance_m} m'
