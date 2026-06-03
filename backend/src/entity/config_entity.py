"""
entity/config_entity.py — Entités de configuration SIGEP-DPE
Définit les Pydantic models pour la validation et la structuration
 des paramètres de l'application.
"""
from pydantic import Field
from pydantic_settings import BaseSettings


class AppConfig(BaseSettings):
    """Configuration principale de l'application backend."""

    app_name: str = Field(default="SIGEP-DPE-Backend", description="Nom de l'application")
    app_version: str = Field(default="1.0.0", description="Version semver")
    app_env: str = Field(default="development", description="Environnement : development | staging | production")
    debug: bool = Field(default=True, description="Mode debug avec rechargement auto")

    api_host: str = Field(default="0.0.0.0", description="Hôte d'écoute FastAPI")
    api_port: int = Field(default=8000, ge=1, le=65535, description="Port d'écoute FastAPI")
    api_workers: int = Field(default=2, ge=1, description="Nombre de workers Uvicorn")

    secret_key: str = Field(default="change-me", description="Clé secrète JWT / sessions")
    algorithm: str = Field(default="HS256", description="Algorithme de signature JWT")
    access_token_expire_minutes: int = Field(default=60, ge=5, description="TTL token d'accès (min)")

    supabase_url: str = Field(default="", description="URL projet Supabase")
    supabase_key: str = Field(default="", description="Clé service-role Supabase")
    supabase_anon_key: str = Field(default="", description="Clé anonyme Supabase")

    database_url: str = Field(default="", description="URL PostgreSQL (fallback)")
    postgres_user: str = Field(default="sigep")
    postgres_password: str = Field(default="sigep2026")
    postgres_db: str = Field(default="sigep_dpe")
    postgres_host: str = Field(default="localhost")
    postgres_port: int = Field(default=5432)

    ollama_base_url: str = Field(default="http://localhost:11434", description="Endpoint Ollama LLM local")
    ollama_model: str = Field(default="llama3", description="Modèle Ollama par défaut")
    hf_model_name: str = Field(
        default="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
        description="Modèle HuggingFace pour embeddings",
    )

    log_level: str = Field(default="INFO", description="Niveau de log : DEBUG | INFO | WARNING | ERROR")
    log_dir: str = Field(default="logs", description="Répertoire des fichiers de log")

    cors_origins: str = Field(
        default="http://localhost:3000,http://127.0.0.1:3000",
        description="Origines CORS autorisées (séparées par des virgules)",
    )

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


class DatabaseConfig(BaseSettings):
    """Configuration spécifique à la base de données."""

    pool_size: int = Field(default=10, ge=1, description="Connexions actives du pool")
    max_overflow: int = Field(default=20, ge=0, description="Connexions overflow autorisées")
    pool_recycle: int = Field(default=3600, ge=0, description="Recycle connexion après N secondes")
    echo: bool = Field(default=False, description="Log SQLAlchemy (debug)")

    class Config:
        env_prefix = "DB_"
        env_file = ".env"
        extra = "ignore"
