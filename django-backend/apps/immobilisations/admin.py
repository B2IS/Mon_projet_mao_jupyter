from django.contrib import admin
from .models import ActifImmobilise, ActifLigne, PVReception


class ActifLigneInline(admin.TabularInline):
    model = ActifLigne
    extra = 0


@admin.register(ActifImmobilise)
class ActifImmobiliseAdmin(admin.ModelAdmin):
    list_display  = ('code', 'designation', 'famille', 'region', 'valeur_brute')
    list_filter   = ('famille', 'region', 'departement')
    search_fields = ('code', 'designation', 'feeder')
    inlines       = [ActifLigneInline]


@admin.register(PVReception)
class PVReceptionAdmin(admin.ModelAdmin):
    list_display  = ('numero', 'actif', 'date_reception_provisoire', 'duree_amort', 'methode')
    list_filter   = ('methode',)
    search_fields = ('numero', 'actif__code')
