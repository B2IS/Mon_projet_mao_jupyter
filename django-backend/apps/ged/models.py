from django.db import models
from django.conf import settings
class Document(models.Model):
    TYPE = [('rapport','Rapport'),('contrat','Contrat'),('facture','Facture'),('photo','Photo'),('plan','Plan'),('autre','Autre')]
    titre    = models.CharField(max_length=300)
    type     = models.CharField(max_length=30, choices=TYPE)
    projet   = models.ForeignKey('projets.Projet', null=True, blank=True, on_delete=models.SET_NULL, related_name='documents')
    fichier  = models.FileField(upload_to='ged/%Y/%m/')
    taille   = models.PositiveIntegerField(default=0, help_text='Taille en octets')
    uploade_par = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        ordering = ['-created_at']
    def __str__(self): return self.titre
