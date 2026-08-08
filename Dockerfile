# Imagen base de Python en Linux
FROM python:3.11-slim

# Instalar Tesseract OCR y el paquete de idioma español ('spa') a nivel de Servidor Web
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-spa \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Directorio de trabajo en el servidor
WORKDIR /app

# Copiar e instalar dependencias de Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el código del proyecto (app.py, static/, etc.)
COPY . .

# Puerto expuesto para la Web
EXPOSE 8000

# Comando de inicio del servidor en producción
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
