from rest_framework import serializers
from .models import ActifImmobilise, ActifLigne, PVReception
from .services import plan_amort, plan_consolide


class ActifLigneSerializer(serializers.ModelSerializer):
    valeur = serializers.SerializerMethodField()

    class Meta:
        model  = ActifLigne
        fields = '__all__'

    def get_valeur(self, obj):
        return float(obj.valeur)


class PVReceptionSerializer(serializers.ModelSerializer):
    class Meta:
        model  = PVReception
        fields = '__all__'


class ActifImmobiliseSerializer(serializers.ModelSerializer):
    lignes = ActifLigneSerializer(many=True, read_only=True)
    pv     = PVReceptionSerializer(read_only=True)

    class Meta:
        model  = ActifImmobilise
        fields = '__all__'


class PlanAmortissementSerializer(serializers.Serializer):
    """Plan consolidé + plan par article, calculés depuis le PV de l'actif."""
    actif        = serializers.SerializerMethodField()
    consolide    = serializers.SerializerMethodField()
    par_article  = serializers.SerializerMethodField()

    def get_actif(self, obj):
        return {'code': obj.code, 'designation': obj.designation, 'valeur_brute': float(obj.valeur_brute)}

    def get_consolide(self, obj):
        pv = getattr(obj, 'pv', None)
        return plan_consolide(obj, pv) if pv else []

    def get_par_article(self, obj):
        pv = getattr(obj, 'pv', None)
        if not pv:
            return []
        out = []
        for ligne in obj.lignes.filter(est_groupe=False):
            if ligne.valeur <= 0:
                continue
            out.append({'code': ligne.code, 'designation': ligne.designation,
                        'valeur': float(ligne.valeur), 'plan': plan_amort(ligne.valeur, pv)})
        return out
