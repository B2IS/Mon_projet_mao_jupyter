from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import Utilisateur, Organisation


@admin.register(Utilisateur)
class UtilisateurAdmin(UserAdmin):
    list_display  = ['email', 'prenom', 'nom', 'role', 'direction', 'is_active']
    list_filter   = ['role', 'direction', 'is_active']
    search_fields = ['email', 'prenom', 'nom']
    ordering      = ['nom']
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Identité', {'fields': ('prenom', 'nom', 'avatar_color')}),
        ('Rôle & Organisation', {'fields': ('role', 'direction', 'departement', 'cellule')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
    )
    add_fieldsets = (
        (None, {'classes': ('wide',), 'fields': ('email', 'prenom', 'nom', 'role', 'direction', 'password1', 'password2')}),
    )


@admin.register(Organisation)
class OrganisationAdmin(admin.ModelAdmin):
    list_display  = ['code', 'libelle', 'type', 'parent', 'actif']
    list_filter   = ['type', 'actif']
    search_fields = ['code', 'libelle']
