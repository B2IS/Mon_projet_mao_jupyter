from django.contrib import admin
from .models import LigneBudget, Decaissement

class DecaissementInline(admin.TabularInline):
    model = Decaissement
    extra = 0

@admin.register(LigneBudget)
class LigneBudgetAdmin(admin.ModelAdmin):
    list_display = ['libelle', 'projet', 'nature', 'montant_revise', 'montant_engage', 'exercice']
    list_filter  = ['nature', 'exercice']
    inlines      = [DecaissementInline]
