# 🛒 Minimarket Invoice AI - Google Gemini & Vercel Edition

Procesador de facturas físicas a XML utilizando **Google Gemini AI Vision API** (`gemini-2.5-flash`) y diseñado para despliegue instantáneo en **Vercel Serverless**.

---

## ✨ Características Principales

- **🤖 Visión por Inteligencia Artificial:** Utiliza la API oficial de Google Gemini 2.5 Flash para analizar facturas de proveedores de alimentos, abarrotes y bebidas con un 99% de precisión.
- **⚡ Despliegue Instantáneo en Vercel:** Sin servidores pesados, sin Docker y sin dependencias de programas del sistema operativo (Cero Tesseract).
- **🏪 Interfaz Tematizada para Minimarkets:** Diseño moderno (modo oscuro con tonos verde esmeralda y dorado).
- **📄 Generación de Archivos XML:** Crea automáticamente archivos `.xml` jerárquicos e indentados listos para integrarse con sistemas de inventario y contabilidad.

---

## 🚀 Despliegue en Vercel en 1 Clic

1. Crea una cuenta en [Vercel.com](https://vercel.com).
2. Haz clic en **"Add New..." ➔ "Project"**.
3. Importa este repositorio de GitHub: `Corenius2026/Facturas`.
4. *(Opcional)* Agrega la variable de entorno `GEMINI_API_KEY` con tu clave de [Google AI Studio](https://aistudio.google.com/app/apikey).
5. Haz clic en **"Deploy"**.

¡Tu aplicación estará en línea e instantánea en menos de 10 segundos!

---

## 🔑 Clave de API de Google Gemini

Puedes obtener una clave de API gratuita en 30 segundos visitando **[Google AI Studio](https://aistudio.google.com/app/apikey)**. La clave se puede pegar directamente en la pantalla de la aplicación web o guardarla como variable de entorno `GEMINI_API_KEY` en tu panel de Vercel.

---

## 📁 Estructura del Proyecto

```
Facturas/
├── api/
│   └── index.py            # Servidor FastAPI Serverless (Google Gemini API)
├── static/
│   ├── index.html          # Interfaz web Minimarket
│   ├── styles.css          # Estilos CSS
│   └── app.js              # Cliente JS para llamadas API
├── vercel.json             # Configuración de rutas para Vercel
├── requirements.txt        # Dependencias ligeras de Python
└── README.md
```
