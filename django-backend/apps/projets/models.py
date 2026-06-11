"""
apps/projets/models.py — Portefeuille, Programmes, Projets, WBS, Tâches
"""
from django.db import models
from django.conf import settings


class StatutProjet(models.TextChoices):
    PLANIFIE   = 'planifie',   'Planifié'
    EN_COURS   = 'en_cours',   'En cours'
    EN_PAUSE   = 'en_pause',   'En pause'
    TERMINE    = 'termine',    'Terminé'
    ANNULE     = 'annule',     'Annulé'
    CRITIQUE   = 'critique',   'Critique'


class PrioriteProjets(models.TextChoices):
    CRITIQUE = 'critique', 'Critique'
    HAUTE    = 'haute',    'Haute'
    MOYENNE  = 'moyenne',  'Moyenne'
    BASSE    = 'basse',    'Basse'


class Programme(models.Model):
    code        = models.CharField(max_length=30, unique=True)
    libelle     = models.CharField(max_length=300)
    description = models.TextField(blank=True)
    budget_total = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    date_debut  = models.DateField(null=True, blank=True)
    date_fin    = models.DateField(null=True, blank=True)
    responsable = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name='programmes')
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Programme'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.code} — {self.libelle}'


class Projet(models.Model):
    code         = models.CharField(max_length=30, unique=True)
    libelle      = models.CharField(max_length=300)
    description  = models.TextField(blank=True)
    programme    = models.ForeignKey(Programme, null=True, blank=True,
                                     on_delete=models.SET_NULL, related_name='projets')
    statut       = models.CharField(max_length=20, choices=StatutProjet.choices, default=StatutProjet.PLANIFIE)
    priorite     = models.CharField(max_length=20, choices=PrioriteProjets.choices, default=PrioriteProjets.MOYENNE)
    chef_projet  = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                     on_delete=models.SET_NULL, related_name='projets_geres')
    date_debut   = models.DateField(null=True, blank=True)
    date_fin_prevu = models.DateField(null=True, blank=True)
    date_fin_reel  = models.DateField(null=True, blank=True)
    avancement   = models.DecimalField(max_digits=5, decimal_places=2, default=0,
                                       help_text='Avancement physique en %')
    budget_initial = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    budget_revise  = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    montant_engage = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    montant_paye   = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    direction    = models.CharField(max_length=10, blank=True)
    departement  = models.CharField(max_length=100, blank=True)
    latitude     = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    longitude    = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Projet'
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['statut']),
            models.Index(fields=['direction']),
            models.Index(fields=['chef_projet']),
        ]

    def __str__(self):
        return f'{self.code} — {self.libelle}'

    @property
    def taux_consommation(self):
        if self.budget_revise:
            return round(float(self.montant_engage) / float(self.budget_revise) * 100, 1)
        return 0


class Jalon(models.Model):
    projet      = models.ForeignKey(Projet, on_delete=models.CASCADE, related_name='jalons')
    libelle     = models.CharField(max_length=200)
    date_prevu  = models.DateField()
    date_reel   = models.DateField(null=True, blank=True)
    atteint     = models.BooleanField(default=False)
    critique    = models.BooleanField(default=False)

    class Meta:
        ordering = ['date_prevu']

    def __str__(self):
        return f'{self.projet.code} · {self.libelle}'


class Tache(models.Model):
    STATUT = [('a_faire', 'À faire'), ('en_cours', 'En cours'),
              ('termine', 'Terminé'), ('en_retard', 'En retard'), ('bloquee', 'Bloquée')]

    projet      = models.ForeignKey(Projet, on_delete=models.CASCADE, related_name='taches')
    libelle     = models.CharField(max_length=300)
    description = models.TextField(blank=True)
    responsable = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name='taches')
    statut      = models.CharField(max_length=20, choices=STATUT, default='a_faire')
    priorite    = models.CharField(max_length=20, choices=PrioriteProjets.choices, default='moyenne')
    date_debut  = models.DateField(null=True, blank=True)
    date_fin    = models.DateField(null=True, blank=True)
    avancement  = models.PositiveSmallIntegerField(default=0)
    predecesseurs = models.ManyToManyField('self', symmetrical=False, blank=True, related_name='successeurs')
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['date_fin', 'priorite']

    def __str__(self):
        return f'{self.projet.code} / {self.libelle}'
