from django.db import models
from django.conf import settings

class Workflow(models.Model):
    TYPE = [('validation','Validation'),('visa','Visa'),('signature','Signature')]
    STATUT = [('en_attente','En attente'),('approuve','Approuvé'),('rejete','Rejeté'),('archive','Archivé')]
    titre       = models.CharField(max_length=300)
    type        = models.CharField(max_length=30, choices=TYPE)
    statut      = models.CharField(max_length=20, choices=STATUT, default='en_attente')
    initiateur  = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='workflows_crees')
    validateur  = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='workflows_a_valider')
    projet      = models.ForeignKey('projets.Projet', null=True, blank=True, on_delete=models.SET_NULL, related_name='workflows')
    commentaire = models.TextField(blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
    def __str__(self): return f'{self.titre} [{self.statut}]'
