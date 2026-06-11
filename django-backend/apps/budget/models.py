from django.db import models
from django.conf import settings


class LigneBudget(models.Model):
    NATURE = [('investissement','Investissement'),('fonctionnement','Fonctionnement'),('etude','Étude')]
    projet      = models.ForeignKey('projets.Projet', on_delete=models.CASCADE, related_name='lignes_budget')
    libelle     = models.CharField(max_length=300)
    nature      = models.CharField(max_length=30, choices=NATURE)
    montant_initial  = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    montant_revise   = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    montant_engage   = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    montant_paye     = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    exercice    = models.PositiveSmallIntegerField()
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Ligne Budget'
        ordering = ['exercice', 'libelle']

    def __str__(self):
        return f'{self.projet.code} / {self.libelle} ({self.exercice})'


class Decaissement(models.Model):
    STATUT = [('prevu','Prévu'),('valide','Validé'),('paye','Payé'),('rejete','Rejeté')]
    ligne_budget = models.ForeignKey(LigneBudget, on_delete=models.CASCADE, related_name='decaissements')
    libelle      = models.CharField(max_length=300)
    montant      = models.DecimalField(max_digits=18, decimal_places=2)
    date_prevu   = models.DateField()
    date_paiement = models.DateField(null=True, blank=True)
    statut       = models.CharField(max_length=20, choices=STATUT, default='prevu')
    reference    = models.CharField(max_length=100, blank=True)
    validateur   = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                     on_delete=models.SET_NULL, related_name='decaissements_valides')
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date_prevu']
