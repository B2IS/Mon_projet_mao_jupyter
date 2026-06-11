"""SIGEPP-DPE — URL root"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import (
    TokenObtainPairView, TokenRefreshView, TokenVerifyView,
)
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

urlpatterns = [
    # Admin Django
    path('admin/', admin.site.urls),

    # ── Auth JWT ──────────────────────────────────────────────────────────────
    path('api/auth/token/',         TokenObtainPairView.as_view(),  name='token_obtain'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(),     name='token_refresh'),
    path('api/auth/token/verify/',  TokenVerifyView.as_view(),      name='token_verify'),

    # ── API métier ────────────────────────────────────────────────────────────
    path('api/', include('apps.core.urls')),
    path('api/', include('apps.projets.urls')),
    path('api/', include('apps.budget.urls')),
    path('api/', include('apps.workflows.urls')),
    path('api/', include('apps.ged.urls')),
    path('api/', include('apps.rh.urls')),
    path('api/', include('apps.risques.urls')),
    path('api/', include('apps.immobilisations.urls')),
    path('api/', include('apps.temps.urls')),

    # ── OpenAPI / Swagger ─────────────────────────────────────────────────────
    path('api/schema/',          SpectacularAPIView.as_view(),        name='schema'),
    path('api/docs/',            SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/',           SpectacularRedocView.as_view(url_name='schema'),   name='redoc'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
