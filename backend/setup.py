"""
setup.py — SIGEP-DPE Backend
Package Python pour le système de gouvernance et pilotage multi-projets DPE.
"""
from setuptools import find_packages, setup

setup(
    name="sigep-dpe-backend",
    version="1.0.0",
    description="Backend SIGEP-DPE — Système Intégré de Gouvernance, d'Exécution et de Pilotage",
    author="Direction Principale Équipement — SENELEC",
    python_requires=">=3.10",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    install_requires=[
        "fastapi>=0.110.0",
        "uvicorn[standard]>=0.29.0",
        "supabase>=2.4.0",
        "psycopg2-binary>=2.9.9",
        "sqlalchemy>=2.0.0",
        "alembic>=1.13.0",
        "numpy>=1.26.0",
        "pandas>=2.2.0",
        "scikit-learn>=1.4.0",
        "transformers>=4.39.0",
        "torch>=2.2.0",
        "sentence-transformers>=2.6.0",
        "python-dotenv>=1.0.0",
        "pydantic>=2.6.0",
        "pydantic-settings>=2.2.0",
        "python-jose[cryptography]>=3.3.0",
        "passlib[bcrypt]>=1.7.4",
        "httpx>=0.27.0",
        "structlog>=24.1.0",
    ],
    extras_require={
        "dev": [
            "pytest>=8.1.0",
            "pytest-asyncio>=0.23.0",
            "pytest-cov>=4.1.0",
            "black>=24.0.0",
            "isort>=5.13.0",
            "flake8>=7.0.0",
        ]
    },
)
