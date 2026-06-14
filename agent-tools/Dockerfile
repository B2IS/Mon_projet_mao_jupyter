FROM python:3.11-slim

# Dépendances système : GDAL (SIG), unzip/unrar (archives), build-essential (C extensions)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    unzip \
    unrar-free \
    gdal-bin \
    libgdal-dev \
    libgeos-dev \
    libproj-dev \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copier requirements avant le code (cache Docker)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8090

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8090", "--reload"]
