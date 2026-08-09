import cv2
import numpy as np
import pytesseract
import re
import xml.etree.ElementTree as ET
import os
import sys
import base64
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.responses import HTMLResponse, Response, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

# ==============================================================================
# CONFIGURACIÓN Y SERVIDOR FASTAPI
# ==============================================================================
app = FastAPI(
    title="FacturaScan AI - Analizador de Facturas a XML",
    description="API y Web App local para procesar facturas físicas con OpenCV, Tesseract OCR y Expresiones Regulares.",
    version="1.0.0"
)

# Permitir CORS para desarrollo local
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Autodetectar Tesseract en Windows
RUTAS_COMUNES_WINDOWS = [
    r'C:\Program Files\Tesseract-OCR\tesseract.exe',
    r'C:\Program Files (x86)\Tesseract-OCR\tesseract.exe',
    os.path.expanduser(r'~\AppData\Local\Programs\Tesseract-OCR\tesseract.exe')
]

TESSERACT_INSTALADO = False
if os.name == 'nt':
    for ruta in RUTAS_COMUNES_WINDOWS:
        if os.path.exists(ruta):
            pytesseract.pytesseract.tesseract_cmd = ruta
            TESSERACT_INSTALADO = True
            break
else:
    # En Linux/macOS asumimos que tesseract está en el PATH si existe
    import shutil
    TESSERACT_INSTALADO = shutil.which("tesseract") is not None

# Servir archivos estáticos (HTML, CSS, JS)
DIR_ACTUAL = os.path.dirname(os.path.abspath(__file__))
DIR_STATIC = os.path.join(DIR_ACTUAL, "static")
os.makedirs(DIR_STATIC, exist_ok=True)
app.mount("/static", StaticFiles(directory=DIR_STATIC), name="static")

# ==============================================================================
# FUNCIONES DE PROCESAMIENTO
# ==============================================================================
def preprocesar_bytes_imagen(bytes_imagen: bytes):
    """
    Convierte bytes en matriz de OpenCV, transforma a escala de grises,
    aplica suavizado gaussiano y binarización (Thresholding Otsu).
    """
    nparr = np.frombuffer(bytes_imagen, np.uint8)
    imagen = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if imagen is None:
        raise ValueError("Formato de imagen no válido o corrupto.")

    # Escala de grises
    gris = cv2.cvtColor(imagen, cv2.COLOR_BGR2GRAY)
    # Filtro Gaussiano
    gris_suave = cv2.GaussianBlur(gris, (5, 5), 0)
    # Thresholding Otsu
    _, umbralizada = cv2.threshold(gris_suave, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    return imagen, umbralizada

def imagen_a_base64(matriz_imagen):
    """Convierte una matriz OpenCV en cadena Data URI Base64 en formato PNG."""
    _, buffer = cv2.imencode('.png', matriz_imagen)
    encoded = base64.b64encode(buffer).decode('utf-8')
    return f"data:image/png;base64,{encoded}"

def extraer_texto_ocr(imagen_procesada) -> tuple[str, bool]:
    """Extrae texto con Tesseract OCR o genera fallback si no está instalado."""
    try:
        try:
            texto = pytesseract.image_to_string(imagen_procesada, lang='spa')
        except pytesseract.TesseractError:
            texto = pytesseract.image_to_string(imagen_procesada)
        return texto, True
    except (pytesseract.TesseractNotFoundError, Exception):
        # Modo simulación/fallback si Tesseract binario no está instalado en la máquina
        texto_demostracion = (
            "COMERCIALIZADORA DE PRUEBA S.A.S.\n"
            "NIT: 900.876.543-1\n"
            "Factura de Venta No. FE-001234\n"
            "Fecha: 15/10/2025\n"
            "-----------------------------------------\n"
            "SUBTOTAL: $800,000\n"
            "IVA (19%): $152,000\n"
            "TOTAL: $952,000\n"
            "-----------------------------------------\n"
            "[NOTA: Tesseract ejecutable no instalado aún en el sistema. Texto de demostración devuelto.]"
        )
        return texto_demostracion, False

def analizar_texto_factura(texto: str) -> dict:
    """Extrae NIT, Fecha, Subtotal, IVA y Total usando Regex."""
    datos = {"NIT": "N/A", "Fecha": "N/A", "Subtotal": "N/A", "IVA": "N/A", "Total": "N/A"}

    # NIT
    p_nit = re.search(r'(?:NIT|RUT|RFC|NIF)[\s.:]*([0-9\.\-]+)', texto, re.IGNORECASE)
    if p_nit:
        datos["NIT"] = p_nit.group(1).strip()

    # Fecha
    p_fecha = re.search(
        r'(?:FECHA|Fecha|Fec)[\s.:]*([0-9]{1,2}[/\.-][0-9]{1,2}[/\.-][0-9]{2,4}|[0-9]{4}[/\.-][0-9]{2}[/\.-][0-9]{2})',
        texto, re.IGNORECASE
    )
    if not p_fecha:
        p_fecha = re.search(r'\b([0-9]{1,2}[/\.-][0-9]{1,2}[/\.-][0-9]{2,4}|[0-9]{4}[/\.-][0-9]{2}[/\.-][0-9]{2})\b', texto)
    if p_fecha:
        datos["Fecha"] = p_fecha.group(1).strip()

    # Subtotal
    p_subtotal = re.search(r'\b(?:SUBTOTAL|Sub[\s-]*total)[\s.:]*\$?\s*([0-9\.,]+)', texto, re.IGNORECASE)
    if p_subtotal:
        datos["Subtotal"] = p_subtotal.group(1).strip()

    # IVA
    p_iva = re.search(r'(?:IVA|I\.V\.A\.|Impuesto)(?:\s*\([^)]*\))?[\s.:]*\$?\s*([0-9\.,]+)', texto, re.IGNORECASE)
    if p_iva:
        datos["IVA"] = p_iva.group(1).strip()

    # Total
    p_total = re.search(r'(?<!SUB)\b(?:TOTAL|Total|Gran[\s]*Total|Valor[\s]*Total)[\s.:]*\$?\s*([0-9\.,]+)', texto, re.IGNORECASE)
    if p_total:
        datos["Total"] = p_total.group(1).strip()

    return datos

def generar_xml_string(datos: dict) -> str:
    """Genera XML indentado como texto UTF-8."""
    raiz = ET.Element("Factura")
    for clave in ["NIT", "Fecha", "Subtotal", "IVA", "Total"]:
        nodo = ET.SubElement(raiz, clave)
        nodo.text = datos.get(clave, "N/A")

    arbol = ET.ElementTree(raiz)
    if hasattr(ET, 'indent'):
        ET.indent(arbol, space="  ", level=0)

    xml_bytes = ET.tostring(raiz, encoding='utf-8', xml_declaration=True)
    return xml_bytes.decode('utf-8')

# ==============================================================================
# ENDPOINTS API
# ==============================================================================
@app.api_route("/", methods=["GET", "HEAD"], response_class=HTMLResponse)
def index():
    """Sirve la interfaz web HTML."""
    path_index = os.path.join(DIR_STATIC, "index.html")
    if os.path.exists(path_index):
        with open(path_index, "r", encoding="utf-8") as f:
            return f.read()
    return "<h1>Error: index.html no encontrado en static/</h1>"

@app.post("/api/procesar")
async def API_procesar_factura(file: UploadFile = File(...)):
    """
    Endpoint principal: recibe archivo de imagen, procesa con OpenCV y Tesseract,
    analiza con Regex y retorna JSON con datos, imágenes base64 y XML.
    """
    try:
        contenido_bytes = await file.read()
        img_original, img_umbralizada = preprocesar_bytes_imagen(contenido_bytes)
        
        texto_raw, ocr_ok = extraer_texto_ocr(img_umbralizada)
        datos = analizar_texto_factura(texto_raw)
        xml_str = generar_xml_string(datos)

        return JSONResponse({
            "success": True,
            "filename": file.filename,
            "ocr_disponible": ocr_ok,
            "raw_text": texto_raw,
            "fields": datos,
            "imagen_original_b64": imagen_a_base64(img_original),
            "imagen_procesada_b64": imagen_a_base64(img_umbralizada),
            "xml_content": xml_str
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/descargar-xml")
async def API_descargar_xml(xml_content: str = Form(...), filename: str = Form("factura.xml")):
    """Endpoint para descargar el contenido XML como archivo descargable."""
    clean_name = filename.rsplit('.', 1)[0] + ".xml"
    return Response(
        content=xml_content,
        media_type="application/xml",
        headers={"Content-Disposition": f"attachment; filename={clean_name}"}
    )

if __name__ == "__main__":
    import uvicorn
    print("[+] Servidor Web iniciado en http://127.0.0.1:8000")
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
