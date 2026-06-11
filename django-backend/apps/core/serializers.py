from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import Utilisateur, Organisation


class UtilisateurSerializer(serializers.ModelSerializer):
    initials = serializers.ReadOnlyField()

    class Meta:
        model  = Utilisateur
        fields = ['id', 'email', 'prenom', 'nom', 'role', 'direction',
                  'departement', 'cellule', 'avatar_color', 'initials', 'date_joined']
        read_only_fields = ['id', 'date_joined', 'initials']


class SIGEPPTokenSerializer(TokenObtainPairSerializer):
    """JWT enrichi avec les infos utilisateur SIGEPP."""
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['prenom']    = user.prenom
        token['nom']       = user.nom
        token['role']      = user.role
        token['direction'] = user.direction
        token['initials']  = user.initials
        return token


class OrganisationSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Organisation
        fields = '__all__'
