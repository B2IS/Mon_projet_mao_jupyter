"""
apps/core/models.py — Modèles transversaux SIGEPP-DPE
Utilisateur étendu, Organisation, Rôles RBAC
"""
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


class RoleCode(models.TextChoices):
    DIR_DPE    = 'DIR_DPE',    'Directeur DPE'
    CHEF_DEPT  = 'CHEF_DEPT',  'Chef de Département'
    CHEF_PROJ  = 'CHEF_PROJ',  'Chef de Projet'
    PMO        = 'PMO',        'PMO'
    CTRL_FIN   = 'CTRL_FIN',   'Contrôleur Financier'
    INGENIEUR  = 'INGENIEUR',  'Ingénieur'
    ASSISTANT  = 'ASSISTANT',  'Assistant Chef de Projet'
    CONTROLEUR = 'CONTROLEUR', 'Contrôleur de Projet'
    RESP_LOG   = 'RESP_LOG',   'Responsable Logistique'
    EXPERT     = 'EXPERT',     'Expert Métier'
    CHARGE     = 'CHARGE',     'Chargé de Projet'
    IMMO       = 'IMMO',       'Gestionnaire Immobilisations'
    SECRETAIRE = 'SECRETAIRE', 'Secrétaire'
    ADMIN      = 'ADMIN',      'Administrateur'


class Direction(models.TextChoices):
    DER = 'DER', 'Direction Équipement Réseaux'
    DEP = 'DEP', 'Direction Études & Planification'
    DTI = 'DTI', 'Direction Travaux Infrastructure'
    DPD = 'DPD', 'Direction Projets Développement'


class UtilisateurManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email obligatoire')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', RoleCode.ADMIN)
        return self.create_user(email, password, **extra_fields)


class Utilisateur(AbstractBaseUser, PermissionsMixin):
    email       = models.EmailField(unique=True)
    prenom      = models.CharField(max_length=80)
    nom         = models.CharField(max_length=80)
    role        = models.CharField(max_length=20, choices=RoleCode.choices, default=RoleCode.CHARGE)
    direction   = models.CharField(max_length=10, choices=Direction.choices, blank=True)
    departement = models.CharField(max_length=100, blank=True)
    cellule     = models.CharField(max_length=100, blank=True)
    avatar_color = models.CharField(max_length=20, default='#3D1A6B')
    is_active   = models.BooleanField(default=True)
    is_staff    = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD  = 'email'
    REQUIRED_FIELDS = ['prenom', 'nom']

    objects = UtilisateurManager()

    class Meta:
        verbose_name = 'Utilisateur'
        verbose_name_plural = 'Utilisateurs'
        ordering = ['nom', 'prenom']

    def __str__(self):
        return f'{self.prenom} {self.nom} ({self.role})'

    @property
    def initials(self):
        return f'{self.prenom[:1]}{self.nom[:1]}'.upper()


class Organisation(models.Model):
    code    = models.CharField(max_length=20, unique=True)
    libelle = models.CharField(max_length=200)
    type    = models.CharField(max_length=50, choices=[
        ('direction', 'Direction'), ('departement', 'Département'), ('cellule', 'Cellule'),
    ])
    parent  = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='enfants')
    actif   = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Organisation'
        ordering = ['code']

    def __str__(self):
        return f'{self.code} — {self.libelle}'
