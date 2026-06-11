from rest_framework import serializers
from .models import Programme, Projet, Jalon, Tache


class JalonSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Jalon
        fields = '__all__'


class TacheSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Tache
        fields = '__all__'


class ProjetListSerializer(serializers.ModelSerializer):
    """Serializer léger pour les listes (portefeuille, cartes)."""
    chef_projet_nom  = serializers.SerializerMethodField()
    taux_consommation = serializers.ReadOnlyField()

    class Meta:
        model  = Projet
        fields = [
            'id', 'code', 'libelle', 'statut', 'priorite',
            'avancement', 'budget_revise', 'montant_engage', 'montant_paye',
            'date_debut', 'date_fin_prevu', 'taux_consommation',
            'chef_projet', 'chef_projet_nom', 'direction', 'departement',
            'latitude', 'longitude', 'updated_at',
        ]

    def get_chef_projet_nom(self, obj):
        if obj.chef_projet:
            return f'{obj.chef_projet.prenom} {obj.chef_projet.nom}'
        return None


class ProjetDetailSerializer(ProjetListSerializer):
    """Serializer complet avec jalons et tâches."""
    jalons = JalonSerializer(many=True, read_only=True)
    taches = TacheSerializer(many=True, read_only=True)

    class Meta(ProjetListSerializer.Meta):
        fields = ProjetListSerializer.Meta.fields + [
            'description', 'budget_initial', 'date_fin_reel',
            'programme', 'jalons', 'taches',
        ]


class ProgrammeSerializer(serializers.ModelSerializer):
    projets_count = serializers.SerializerMethodField()

    class Meta:
        model  = Programme
        fields = '__all__'

    def get_projets_count(self, obj):
        return obj.projets.count()
