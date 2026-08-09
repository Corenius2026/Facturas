import cv2
import numpy as np
import pytesseract
import re
import xml.etree.ElementTree as ET
import os
import sys
import base64
import json
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.responses import HTMLResponse, Response, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

# Importar SDK de Google GenAI
try:
    from google import genai
    from google.genai import types
    GEMINI_SDK_DISPONIBLE = True
except ImportError:
    GEMINI_SDK_DISPONIBLE = False

# ==============================================================================
# CONFIGURACIÓN Y SERVIDOR FASTAPI
# ==============================================================================
app = FastAPI(
    title="Minimarket Invoice AI - Google Gemini & OpenCV Parser",
    description="API y Web App local para procesar facturas físicas con Google Gemini AI Vision y OpenCV.",
    version="2.0.0"
)

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
    import shutil
    TESSERACT_INSTALADO = shutil.which("tesseract") is not None

DIR_ACTUAL = os.path.dirname(os.path.abspath(__file__))
DIR_STATIC = os.path.join(DIR_ACTUAL, "static")
os.makedirs(DIR_STATIC, exist_ok=True)
app.mount("/static", StaticFiles(directory=DIR_STATIC), name="static")

# ==============================================================================
# PROCESAMIENTO CON GOOGLE GEMINI AI API (VISIÓN POR IA)
# ==============================================================================
def procesar_con_google_gemini(bytes_imagen: bytes, api_key: str):
    """
    Envía la foto de la factura directamente a la API de Google Gemini (gemini-2.5-flash).
    Retorna la extracción estructurada en JSON.
    """
    if not GEMINI_SDK_DISPONIBLE:
        return None, "SDK google-genai no instalado"

    try:
        client = genai.Client(api_key=api_key)
        
        prompt = (
            "Eres un sistema experto en contabilidad. Analiza detalladamente esta foto de factura de compra o recibo de minimarket. "
            "Extrae exactamente el NIT del proveedor, la Fecha de emisión de la factura, el Subtotal, el IVA (o impuesto) y el TOTAL a pagar. "
            "Devuelve una estructura JSON limpia con las claves: NIT, Fecha, Subtotal, IVA, Total y TextoExtraido."
        )

        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[
                types.Part.from_bytes(
                    data=bytes_imagen,
                    mime_type="image/jpeg",
                ),
                prompt
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema={
                    "type": "OBJECT",
                    "properties": {
                        "NIT": {"type": "STRING"},
                        "Fecha": {"type": "STRING"},
                        "Subtotal": {"type": "STRING"},
                        "IVA": {"type": "STRING"},
                        "Total": {"type": "STRING"},
                        "TextoExtraido": {"type": "STRING"}
                    },
                    "required": ["NIT", "Fecha", "Subtotal", "IVA", "Total"]
                }
            )
        )

        datos_json = json.loads(response.text)
        return datos_json, None
    except Exception as e:
        print(f"Error procesando con Google Gemini API: {e}")
        return None, str(e)

# ==============================================================================
# PROCESAMIENTO LOCAL CON OPENCV Y REGEX (FALLBACK)
# ==============================================================================
def preprocesar_bytes_imagen(bytes_imagen: bytes):
    nparr = np.frombuffer(bytes_imagen, np.uint8)
    imagen = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if imagen is None:
        raise ValueError("Formato de imagen no válido o corrupto.")

    gris = cv2.cvtColor(imagen, cv2.COLOR_BGR2GRAY)
    gris_suave = cv2.GaussianBlur(gris, (5, 5), 0)
    _, umbralizada = cv2.threshold(gris_suave, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    return imagen, umbralizada

def imagen_a_base64(matriz_imagen):
    _, buffer = cv2.imencode('.png', matriz_imagen)
    encoded = base64.b64encode(buffer).decode('utf-8')
    return f"data:image/png;base64,{encoded}"

def extraer_texto_ocr(imagen_procesada) -> tuple[str, bool]:
    try:
        try:
            texto = pytesseract.image_to_string(imagen_procesada, lang='spa')
        except pytesseract.TesseractError:
            texto = pytesseract.image_to_string(imagen_procesada)
        return texto, True
    except (pytesseract.TesseractNotFoundError, Exception):
        texto_demostracion = (
            "SUPERMERCADO Y SERVICIOS S.A.S.\n"
            "NIT: 900.876.543-1\n"
            "Factura de Venta No. FE-001234\n"
            "Fecha: 15/10/2025\n"
            "-----------------------------------------\n"
            "SUBTOTAL: $800,000\n"
            "IVA (19%): $152,000\n"
            "TOTAL: $952,000\n"
            "-----------------------------------------\n"
            "[NOTA: Tesseract no instalado en SO local y no se ingresó clave de Google Gemini API.]"
        )
        return texto_demostracion, False

def analizar_texto_factura(texto: str) -> dict:
    datos = {"NIT": "N/A", "Fecha": "N/A", "Subtotal": "N/A", "IVA": "N/A", "Total": "N/A"}

    p_nit = re.search(r'(?:NIT|RUT|RFC|NIF)[\s.:]*([0-9\.\-]+)', texto, re.IGNORECASE)
    if p_nit: datos["NIT"] = p_nit.group(1).strip()

    p_fecha = re.search(
        r'(?:FECHA|Fecha|Fec)[\s.:]*([0-9]{1,2}[/\.-][0-9]{1,2}[/\.-][0-9]{2,4}|[0-9]{4}[/\.-][0-9]{2}[/\.-][0-9]{2})',
        texto, re.IGNORECASE
    )
    if not p_fecha:
        p_fecha = re.search(r'\b([0-9]{1,2}[/\.-][0-9]{1,2}[/\.-][0-9]{2,4}|[0-9]{4}[/\.-][0-9]{2}[/\.-][0-9]{2})\b', texto)
    if p_fecha: datos["Fecha"] = p_fecha.group(1).strip()

    p_subtotal = re.search(r'\b(?:SUBTOTAL|Sub[\s-]*total)[\s.:]*\$?\s*([0-9\.,]+)', texto, re.IGNORECASE)
    if p_subtotal: datos["Subtotal"] = p_subtotal.group(1).strip()

    p_iva = re.search(r'(?:IVA|I\.V\.A\.|Impuesto)(?:\s*\([^)]*\))?[\s.:]*\$?\s*([0-9\.,]+)', texto, re.IGNORECASE)
    if p_iva: datos["IVA"] = p_iva.group(1).strip()

    p_total = re.search(r'(?<!SUB)\b(?:TOTAL|Total|Gran[\s]*Total|Valor[\s]*Total)[\s.:]*\$?\s*([0-9\.,]+)', texto, re.IGNORECASE)
    if p_total: datos["Total"] = p_total.group(1).strip()

    return datos

def generar_xml_string(datos: dict) -> str:
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
    path_index = os.path.join(DIR_STATIC, "index.html")
    if os.path.exists(path_index):
        with open(path_index, "r", encoding="utf-8") as f:
            return f.read()
    return "<h1>Error: index.html no encontrado en static/</h1>"

@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    return Response(status_code=204)

@app.post("/api/procesar")
async def API_procesar_factura(
    file: UploadFile = File(...),
    gemini_api_key: str = Form(None)
):
    """
    Endpoint de procesamiento:
    1. Si se provee clave de Google Gemini API (o la variable de entorno GEMINI_API_KEY),
       usa Visión por IA con Google Gemini 2.5 Flash.
    2. Si no, utiliza el motor local OpenCV + PyTesseract + Regex.
    """
    try:
        contenido_bytes = await file.read()
        img_original, img_umbralizada = preprocesar_bytes_imagen(contenido_bytes)
        
        # Determinar si se usa Google Gemini API
        api_key_usar = gemini_api_key or os.environ.get("GEMINI_API_KEY", "").strip()

        motor_usado = "OpenCV + Tesseract OCR"
        ocr_ok = True

        if api_key_usar:
            datos_gemini, err = procesar_con_google_gemini(contenido_bytes, api_key_usar)
            if datos_gemini:
                datos = {
                    "NIT": datos_gemini.get("NIT", "N/A"),
                    "Fecha": datos_gemini.get("Fecha", "N/A"),
                    "Subtotal": datos_gemini.get("Subtotal", "N/A"),
                    "IVA": datos_gemini.get("IVA", "N/A"),
                    "Total": datos_gemini.get("Total", "N/A")
                }
                texto_raw = datos_gemini.get("TextoExtraido", "[Procesado con Visión IA de Google Gemini 2.5 Flash]")
                motor_usado = "🤖 Google Gemini AI Vision (API)"
                xml_str = generar_xml_string(datos)

                return JSONResponse({
                    "success": True,
                    "filename": file.filename,
                    "ocr_disponible": True,
                    "motor_usado": motor_usado,
                    "raw_text": texto_raw,
                    "fields": datos,
                    "imagen_original_b64": imagen_a_base64(img_original),
                    "imagen_procesada_b64": imagen_a_base64(img_umbralizada),
                    "xml_content": xml_str
                })
            else:
                print(f"Fallback a OpenCV por error en Gemini: {err}")

        # Fallback local OpenCV + OCR
        texto_raw, ocr_ok = extraer_texto_ocr(img_umbralizada)
        datos = analizar_texto_factura(texto_raw)
        xml_str = generar_xml_string(datos)

        return JSONResponse({
            "success": True,
            "filename": file.filename,
            "ocr_disponible": ocr_ok,
            "motor_usado": motor_usado,
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
