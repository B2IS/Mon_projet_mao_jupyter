from rest_framework import viewsets, permissions
from .models import Workflow
from .serializers import WorkflowSerializer
class WorkflowViewSet(viewsets.ModelViewSet):
    queryset = Workflow.objects.select_related('initiateur','validateur','projet').all()
    serializer_class = WorkflowSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['statut','type','validateur']
