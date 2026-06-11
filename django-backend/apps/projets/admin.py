from django.contrib import admin
from .models import Programme, Projet, Jalon, Tache


class JalonInline(admin.TabularInline):
    model  = Jalon
    extra  = 0
    fields = ['libelle', 'date_prevu', 'date_reel', 'atteint', 'critique']


class TacheInline(admin.TabularInline):
    model  = Tache
    extra  = 0
    fields = ['libelle', 'statut', 'priorite', 'responsable', 'date_fin', 'avancement']


@admin.register(Programme)
class ProgrammeAdmin(admin.ModelAdmin):
    list_display  = ['code', 'libelle', 'budget_total', 'date_debut', 'date_fin']
    search_fields = ['code', 'libelle']


@admin.register(Projet)
class ProjetAdmin(admin.ModelAdmin):
    list_display  = ['code', 'libelle', 'statut', 'priorite', 'avancement', 'chef_projet', 'updated_at']
    list_filter   = ['statut', 'priorite', 'direction']
    search_fields = ['code', 'libelle']
    inlines       = [JalonInline, TacheInline]
    readonly_fields = ['created_at', 'updated_at']


@admin.register(Tache)
class TacheAdmin(admin.ModelAdmin):
    list_display  = ['libelle', 'projet', 'statut', 'priorite', 'responsable', 'date_fin']
    list_filter   = ['statut', 'priorite']
    search_fields = ['libelle', 'projet__code']
