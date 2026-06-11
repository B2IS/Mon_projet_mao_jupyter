"""
SIGEPP-DPE — Django 5 Settings
Architecture : API REST découplée (consommée par Next.js 15)
"""
from pathlib import Path
from datetime import timedelta
from decouple import config

BASE_DIR = Path(__file__).resolve().parent.parent

# ── Sécurité ────────────────────────────────────────────────────────────────
SECRET_KEY = config('DJANGO_SECRET_KEY', default='dev-secret-key-change-in-prod-senelec-dpe')
DEBUG      = config('DJANGO_DEBUG', default=True, cast=bool)
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost,127.0.0.1', cast=lambda v: [s.strip() for s in v.split(',')])

# ── Applications ─────────────────────────────────────────────────────────────
INSTALLED_APPS = [
    # Django
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Tiers
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'django_filters',
    'drf_spectacular',
    # SIGEPP apps
    'apps.core',
    'apps.projets',
    'apps.budget',
    'apps.workflows',
    'apps.ged',
    'apps.rh',
    'apps.risques',
    'apps.immobilisations',
    'apps.temps',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',   # DOIT être en premier
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'sigepp.urls'
WSGI_APPLICATION = 'sigepp.wsgi.application'

# ── Base de données (Supabase / PostgreSQL) ───────────────────────────────────
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME':     config('DB_NAME',     default='sigepp_dpe'),
        'USER':     config('DB_USER',     default='postgres'),
        'PASSWORD': config('DB_PASSWORD', default=''),
        'HOST':     config('DB_HOST',     default='localhost'),
        'PORT':     config('DB_PORT',     default='5432'),
    }
}

# ── Authentification personnalisée ────────────────────────────────────────────
AUTH_USER_MODEL = 'core.Utilisateur'

# ── Django REST Framework ─────────────────────────────────────────────────────
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 25,
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

# ── JWT ───────────────────────────────────────────────────────────────────────
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME':  timedelta(hours=8),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS':  True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'UPDATE_LAST_LOGIN': True,
}

# ── CORS — Next.js frontend ───────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = config(
    'CORS_ORIGINS',
    default='http://localhost:3000,http://localhost:3001',
    cast=lambda v: [s.strip() for s in v.split(',')],
)
CORS_ALLOW_CREDENTIALS = True

# ── OpenAPI / Swagger ─────────────────────────────────────────────────────────
SPECTACULAR_SETTINGS = {
    'TITLE':       'SIGEPP-DPE API',
    'DESCRIPTION': 'API REST — Plateforme Intégrée de Gestion des Projets DPE · SENELEC',
    'VERSION':     '1.0.0',
    'CONTACT': {'email': 'dpe@senelec.sn'},
    'TAGS': [
        {'name': 'auth',            'description': 'Authentification JWT'},
        {'name': 'projets',         'description': 'Gestion des projets'},
        {'name': 'budget',          'description': 'Budget & décaissements'},
        {'name': 'workflows',       'description': 'Parapheur & validations'},
        {'name': 'ged',             'description': 'Gestion électronique des documents'},
        {'name': 'rh',              'description': 'Ressources humaines'},
        {'name': 'risques',         'description': 'Risques & QHSE'},
        {'name': 'immobilisations', 'description': 'Immobilisations & patrimoine'},
    ],
}

# ── Internationalisation ──────────────────────────────────────────────────────
LANGUAGE_CODE = 'fr-fr'
TIME_ZONE     = 'Africa/Dakar'
USE_I18N = USE_TZ = True

# ── Fichiers statiques & médias ───────────────────────────────────────────────
STATIC_URL  = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL   = '/media/'
MEDIA_ROOT  = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

TEMPLATES = [{
    'BACKEND': 'django.template.backends.django.DjangoTemplates',
    'DIRS': [BASE_DIR / 'templates'],
    'APP_DIRS': True,
    'OPTIONS': {'context_processors': [
        'django.template.context_processors.debug',
        'django.template.context_processors.request',
        'django.contrib.auth.context_processors.auth',
        'django.contrib.messages.context_processors.messages',
    ]},
}]
