from rest_framework import serializers
from .models import LigneBudget, Decaissement


class DecaissementSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Decaissement
        fields = '__all__'


class LigneBudgetSerializer(serializers.ModelSerializer):
    decaissements    = DecaissementSerializer(many=True, read_only=True)
    taux_engagement  = serializers.SerializerMethodField()
    taux_paiement    = serializers.SerializerMethodField()

    class Meta:
        model  = LigneBudget
        fields = '__all__'

    def get_taux_engagement(self, obj):
        if obj.montant_revise:
            return round(float(obj.montant_engage) / float(obj.montant_revise) * 100, 1)
        return 0

    def get_taux_paiement(self, obj):
        if obj.montant_engage:
            return round(float(obj.montant_paye) / float(obj.montant_engage) * 100, 1)
        return 0
