import base64
import json
import os
import xml.etree.ElementTree as ET
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.responses import HTMLResponse, Response, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

# Importar SDK oficial de Google GenAI
try:
    from google import genai
    from google.genai import types
    GEMINI_DISPONIBLE = True
except ImportError:
    GEMINI_DISPONIBLE = False

# ==============================================================================
# CONFIGURACIÓN Y SERVIDOR FASTAPI SERVERLESS (VERCEL)
# ==============================================================================
app = FastAPI(
    title="Minimarket Invoice AI - Google Gemini Vision API",
    description="Analizador inteligente de facturas físicas a XML con la API de Visión de Google Gemini (Vercel Ready).",
    version="3.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==============================================================================
# FUNCIÓN DE ANÁLISIS DE IMAGEN CON GOOGLE GEMINI AI
# ==============================================================================
def procesar_con_google_gemini(bytes_imagen: bytes, api_key: str):
    """
    Envía la foto de la factura directamente a la API de Google Gemini (gemini-2.5-flash).
    Devuelve la extracción estructurada de NIT, Fecha, Subtotal, IVA y Total en JSON.
    """
    if not GEMINI_DISPONIBLE:
        return None, "Librería google-genai no instalada."

    try:
        client = genai.Client(api_key=api_key)
        
        prompt = (
            "Eres un experto contable comercial. Analiza con precisión esta foto de factura de compra o recibo de minimarket. "
            "Extrae exactamente los datos clave: NIT del proveedor, Fecha de emisión, Subtotal de la mercancía, IVA (impuesto) y TOTAL a pagar. "
            "Devuelve un formato JSON estricto con las claves: NIT, Fecha, Subtotal, IVA, Total y TextoExtraido."
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
# GENERACIÓN DE ESTRUCTURA XML
# ==============================================================================
def generar_xml_string(datos: dict) -> str:
    raiz = ET.Element("Factura")
    for clave in ["NIT", "Fecha", "Subtotal", "IVA", "Total"]:
        nodo = ET.SubElement(raiz, clave)
        nodo.text = str(datos.get(clave, "N/A"))

    if hasattr(ET, 'indent'):
        ET.indent(raiz, space="  ", level=0)

    xml_bytes = ET.tostring(raiz, encoding='utf-8', xml_declaration=True)
    return xml_bytes.decode('utf-8')

# ==============================================================================
# ENDPOINTS API SERVERLESS
# ==============================================================================
@app.get("/api/health")
def health_check():
    return {"status": "ok", "engine": "Google Gemini AI Vision API", "platform": "Vercel Serverless"}

@app.post("/api/procesar")
async def API_procesar_factura(
    file: UploadFile = File(...),
    gemini_api_key: str = Form(None)
):
    """
    Endpoint principal para analizar la factura de minimarket mediante la API de Google Gemini.
    """
    try:
        contenido_bytes = await file.read()
        
        # Obtener API Key del formulario o de la variable de entorno de Vercel (GEMINI_API_KEY)
        api_key_usar = gemini_api_key or os.environ.get("GEMINI_API_KEY", "").strip()

        if not api_key_usar:
            raise HTTPException(
                status_code=400,
                detail="Se requiere una clave de API de Google Gemini. Ingresa tu API Key en la pantalla o configúrala en las variables de entorno de Vercel (GEMINI_API_KEY)."
            )

        datos_gemini, err_msg = procesar_con_google_gemini(contenido_bytes, api_key_usar)

        if not datos_gemini:
            raise HTTPException(
                status_code=500,
                detail=f"Error en la API de Google Gemini: {err_msg}"
            )

        datos = {
            "NIT": datos_gemini.get("NIT", "N/A"),
            "Fecha": datos_gemini.get("Fecha", "N/A"),
            "Subtotal": datos_gemini.get("Subtotal", "N/A"),
            "IVA": datos_gemini.get("IVA", "N/A"),
            "Total": datos_gemini.get("Total", "N/A")
        }

        texto_raw = datos_gemini.get("TextoExtraido", "[Factura analizada con Inteligencia Artificial Multimodal Google Gemini 2.5 Flash]")
        xml_str = generar_xml_string(datos)

        # Base64 para vista previa instantánea en la interfaz
        encoded_b64 = f"data:image/jpeg;base64,{base64.b64encode(contenido_bytes).decode('utf-8')}"

        return JSONResponse({
            "success": True,
            "filename": file.filename,
            "motor_usado": "🤖 Google Gemini AI Vision API",
            "raw_text": texto_raw,
            "fields": datos,
            "imagen_original_b64": encoded_b64,
            "xml_content": xml_str
        })
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/descargar-xml")
async def API_descargar_xml(xml_content: str = Form(...), filename: str = Form("factura.xml")):
    clean_name = filename.rsplit('.', 1)[0] + ".xml"
    return Response(
        content=xml_content,
        media_type="application/xml",
        headers={"Content-Disposition": f"attachment; filename={clean_name}"}
    )
