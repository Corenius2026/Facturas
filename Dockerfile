# Imagen base de Python en Linux (Debian 12 Bookworm)
FROM python:3.11-slim

# Evitar prompts interactivos durante la instalación de apt
ENV DEBIAN_FRONTEND=noninteractive

# Instalar Tesseract OCR, soporte para español y librerías necesarias para OpenCV (libgl1)
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-spa \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Directorio de trabajo en el servidor
WORKDIR /app

# Copiar e instalar dependencias de Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el código del proyecto
COPY . .

# Puerto expuesto para la Web
EXPOSE 8000

# Comando de inicio del servidor web FastAPI
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
