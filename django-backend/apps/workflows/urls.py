from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import WorkflowViewSet
router = DefaultRouter()
router.register('workflows', WorkflowViewSet)
urlpatterns = [path('', include(router.urls))]
