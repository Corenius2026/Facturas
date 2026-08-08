# 🛒 Minimarket Invoice AI - Analizador de Facturas a XML

Procesador inteligente de fotografías de facturas de proveedores para tiendas y minimarkets. Utiliza herramientas 100% de código abierto (**FastAPI**, **OpenCV**, **PyTesseract** y **ElementTree**) para preprocesar imágenes, reconocer texto mediante OCR, capturar montos clave con Expresiones Regulares y estructurar la información en archivos XML compatibles con sistemas contables e inventarios.

---

## ✨ Características Principales

- **🏪 Interfaz Tematizada para Minimarkets:** Maquetación web moderna (modo oscuro con paleta verde esmeralda y dorado).
- **📸 Preprocesamiento con OpenCV:** Conversión a escala de grises, suavizado gaussiano y umbralización binarizada de Otsu para maximizar la nitidez de fotos borrosas.
- **🔍 Extracción por OCR (PyTesseract):** Motor Tesseract con soporte para idioma español (`spa`).
- **📊 Captura Inteligente con Regex (`re`):**
  - NIT / RUT del Proveedor
  - Fecha de Emisión
  - Subtotal Mercancía
  - Impuesto / IVA (19%)
  - Total de la Compra
- **📄 Generación de Archivo XML (`ElementTree`):** Estructura `.xml` jerárquica con sangría visual.
- **☁️ Listo para Despliegue en la Nube:** Incluye `Dockerfile` para publicar en **Render.com**, **Railway**, **AWS**, etc.

---

## 🛠️ Requisitos Previos (Para Ejecución Local)

1. **Python 3.10+**
2. **Tesseract OCR (Ejecutable del Sistema Operativo)**
   - **Windows:** Descargar desde [UB-Mannheim Tesseract Wiki](https://github.com/UB-Mannheim/tesseract/wiki) (Asegurarse de marcar la opción *Spanish language data* durante la instalación).
   - **Linux:** `sudo apt install tesseract-ocr tesseract-ocr-spa`
   - **macOS:** `brew install tesseract tesseract-lang`

---

## 🚀 Instalación y Ejecución Local

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/Corenius2026/Facturas.git
   cd Facturas
   ```

2. **Instalar dependencias de Python:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Iniciar la Aplicación Web:**
   ```bash
   python app.py
   ```

4. **Abrir en el navegador:**
   Ingresa a [http://127.0.0.1:8000/](http://127.0.0.1:8000/)

---

## ☁️ Despliegue en la Nube (Web Pública)

El proyecto cuenta con un `Dockerfile` optimizado. Para publicar la aplicación en internet sin que los usuarios tengan que instalar nada en sus equipos:

1. Crea una cuenta en [Render.com](https://render.com) o [Railway.app](https://railway.app).
2. Conecta este repositorio de GitHub.
3. El servicio detectará el `Dockerfile` e instalará automáticamente Tesseract OCR y las dependencias de Python en el servidor web.

---

## 📄 Licencia

Este proyecto se distribuye bajo la licencia MIT. Uso libre y de código abierto.
