from rest_framework import viewsets, permissions
from .models import Document
from .serializers import DocumentSerializer
class DocumentViewSet(viewsets.ModelViewSet):
    queryset = Document.objects.all()
    serializer_class = DocumentSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['type','projet']
    search_fields = ['titre']
