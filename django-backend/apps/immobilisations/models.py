"""
apps/immobilisations/models.py — Immobilisations & Patrimoine
-------------------------------------------------------------
Miroir du module frontend :
  • ActifImmobilise  — actif assemblé depuis une FAMILLE du référentiel (feuille 4)
  • ActifLigne       — article capitalisé (WBS, code hiérarchique + valeur FCFA)
  • PVReception      — PV de réception provisoire = mise en service (fait générateur)

Le plan d'amortissement (prorata temporis SYSCOHADA) est calculé à la volée
côté serializer — pas stocké — pour rester cohérent avec un PV qui peut évoluer.
"""
from django.db import models
from django.conf import settings


class FamilleActif(models.TextChoices):
    REEQ_COUP  = 'REEQ.COUP',  'Rééquipement GIS — Coupure'
    REEQ_TE    = 'REEQ.TE',    'Rééquipement GIS — Té'
    REEQ_MAN   = 'REEQ.MAN',   'Rééquipement GIS — Poste de manœuvre'
    PREFA_COUP = 'PREFA.COUP', 'Poste préfabriqué — Coupure'
    PREFA_TE   = 'PREFA.TE',   'Poste préfabriqué — Té'
    DESAF_HAUT = 'DESAF.HAUT', 'Désaffectation — Postes hauts'
    DESAF_BAS  = 'DESAF.BAS',  'Désaffectation — Postes bas'


class MethodeAmortissement(models.TextChoices):
    LINEAIRE  = 'lineaire',  'Linéaire (prorata temporis)'
    DEGRESSIF = 'degressif', 'Dégressif'


class ActifImmobilise(models.Model):
    code          = models.CharField(max_length=40, unique=True)      # REEQ.COUP.2
    famille       = models.CharField(max_length=20, choices=FamilleActif.choices)
    designation   = models.CharField(max_length=400)                  # … COUPURE CHERIF LO
    region        = models.CharField(max_length=120, blank=True)
    departement   = models.CharField(max_length=120, blank=True)
    feeder        = models.CharField(max_length=120, blank=True)
    poste_source  = models.CharField(max_length=160, blank=True)
    projet        = models.ForeignKey('projets.Projet', null=True, blank=True,
                                      on_delete=models.SET_NULL, related_name='actifs')
    valeur_brute  = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Actif immobilisé'
        ordering = ['code']

    def __str__(self):
        return f'{self.code} — {self.designation}'


class ActifLigne(models.Model):
    actif        = models.ForeignKey(ActifImmobilise, on_delete=models.CASCADE, related_name='lignes')
    code         = models.CharField(max_length=50)                    # REEQ.COUP.2.5.1
    parent_code  = models.CharField(max_length=50, blank=True)
    designation  = models.CharField(max_length=400)
    unite        = models.CharField(max_length=12, blank=True)
    quantite     = models.DecimalField(max_digits=12, decimal_places=4, default=1)
    fourniture   = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    transport    = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    montage      = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    est_groupe   = models.BooleanField(default=False)

    class Meta:
        verbose_name = 'Ligne d’actif (WBS)'
        ordering = ['code']
        unique_together = [('actif', 'code')]

    @property
    def valeur(self):
        pu = (self.fourniture or 0) + (self.transport or 0) + (self.montage or 0)
        return pu * (self.quantite or 1)

    def __str__(self):
        return f'{self.code} — {self.designation}'


class PVReception(models.Model):
    numero                     = models.CharField(max_length=40)
    actif                      = models.OneToOneField(ActifImmobilise, on_delete=models.CASCADE, related_name='pv')
    date_reception_provisoire  = models.DateField()                   # = mise en service / début amort.
    duree_amort                = models.PositiveSmallIntegerField(default=20)
    methode                    = models.CharField(max_length=12, choices=MethodeAmortissement.choices,
                                                  default=MethodeAmortissement.LINEAIRE)
    valeur_residuelle          = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    signe_par                  = models.CharField(max_length=160, blank=True)
    date_signature             = models.DateField(null=True, blank=True)
    observations               = models.TextField(blank=True)
    created_at                 = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'PV de réception provisoire'
        ordering = ['-date_reception_provisoire']

    def __str__(self):
        return f'{self.numero} — {self.actif.code}'
