import cv2
import pytesseract
import re
import xml.etree.ElementTree as ET
import os
import sys

# ==============================================================================
# CONFIGURACIÓN DE TESSERACT OCR
# ==============================================================================
# En Windows, si Tesseract no está agregado a las Variables de Entorno (PATH),
# se debe definir la ruta directa al ejecutable 'tesseract.exe'.
# Descomenta o ajusta la siguiente línea si es tu caso:
# pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

# Autodetectar en rutas habituales de instalación en Windows
RUTAS_COMUNES_WINDOWS = [
    r'C:\Program Files\Tesseract-OCR\tesseract.exe',
    r'C:\Program Files (x86)\Tesseract-OCR\tesseract.exe',
    os.path.expanduser(r'~\AppData\Local\Programs\Tesseract-OCR\tesseract.exe')
]

if os.name == 'nt':
    for ruta in RUTAS_COMUNES_WINDOWS:
        if os.path.exists(ruta):
            pytesseract.pytesseract.tesseract_cmd = ruta
            break

# ==============================================================================
# PASO 1: PREPROCESAMIENTO DE LA IMAGEN CON OPENCV (cv2)
# ==============================================================================
def preprocesar_imagen(ruta_imagen: str):
    """
    1. Carga la imagen desde el disco.
    2. La convierte a escala de grises para eliminar información de color innecesaria.
    3. Aplica un suavizado gaussiano para reducir ruido de fondo.
    4. Aplica umbralización/thresholding (Binarización Otsu) para separar el texto
       del fondo y maximizar el contraste para el OCR.
    """
    # 1. Cargar la imagen desde el disco
    imagen = cv2.imread(ruta_imagen)
    if imagen is None:
        raise FileNotFoundError(f"Error: No se pudo cargar la imagen en la ruta '{ruta_imagen}'")

    # 2. Convertir a escala de grises
    gris = cv2.cvtColor(imagen, cv2.COLOR_BGR2GRAY)

    # 3. Aplicar filtro Gaussiano para reducir el ruido
    gris_suave = cv2.GaussianBlur(gris, (5, 5), 0)

    # 4. Thresholding (Binarización Otsu)
    # Convierte la imagen a blanco y negro puro (valores 0 o 255)
    _, umbralizada = cv2.threshold(gris_suave, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    return umbralizada

# ==============================================================================
# PASO 2: EXTRACCIÓN DE TEXTO CON PYTESSERACT (Tesseract OCR)
# ==============================================================================
def extraer_texto_ocr(imagen_procesada) -> str:
    """
    Recibe la imagen procesada en blanco y negro y utiliza Tesseract OCR
    para reconocer y extraer todo el texto disponible.
    """
    try:
        # Se intenta extraer el texto especificando el paquete de idioma en español ('spa')
        texto = pytesseract.image_to_string(imagen_procesada, lang='spa')
    except pytesseract.TesseractError:
        # Si el paquete de idioma 'spa' no está instalado, se intenta con el idioma por defecto
        print("[-] Advertencia: Paquete de idioma español ('spa') no detectado en Tesseract. Usando idioma por defecto.")
        texto = pytesseract.image_to_string(imagen_procesada)
    except pytesseract.TesseractNotFoundError:
        print("\n[!] ERROR: No se encontró el motor ejecutable de Tesseract en el sistema.")
        print("    Asegúrate de instalar Tesseract OCR a nivel de sistema operativo y agregarlo al PATH.")
        print("    Ver instrucciones completas en la respuesta.")
        sys.exit(1)
        
    return texto

# ==============================================================================
# PASO 3: ANÁLISIS DEL TEXTO CON EXPRESIONES REGULARES (re)
# ==============================================================================
def analizar_texto_factura(texto: str) -> dict:
    """
    Utiliza expresiones regulares (re) para escanear el texto extraído
    y capturar los 5 campos solicitados: NIT del proveedor, Fecha de la factura,
    Subtotal, IVA y Total.
    """
    datos = {
        "NIT": "N/A",
        "Fecha": "N/A",
        "Subtotal": "N/A",
        "IVA": "N/A",
        "Total": "N/A"
    }

    # 1. NIT del Proveedor (Soporta NIT, RUT, RFC, NIF con o sin digito de verificación)
    patron_nit = re.search(r'(?:NIT|RUT|RFC|NIF)[\s.:]*([0-9\.\-]+)', texto, re.IGNORECASE)
    if patron_nit:
        datos["NIT"] = patron_nit.group(1).strip()

    # 2. Fecha de la factura (Soporta DD/MM/YYYY, DD-MM-YYYY, YYYY/MM/DD, etc.)
    patron_fecha = re.search(
        r'(?:FECHA|Fecha|Fec)[\s.:]*([0-9]{1,2}[/\.-][0-9]{1,2}[/\.-][0-9]{2,4}|[0-9]{4}[/\.-][0-9]{2}[/\.-][0-9]{2})',
        texto,
        re.IGNORECASE
    )
    if not patron_fecha:
        # Búsqueda fallback de fechas estándar en cualquier lugar del texto
        patron_fecha = re.search(r'\b([0-9]{1,2}[/\.-][0-9]{1,2}[/\.-][0-9]{2,4}|[0-9]{4}[/\.-][0-9]{2}[/\.-][0-9]{2})\b', texto)
    
    if patron_fecha:
        datos["Fecha"] = patron_fecha.group(1).strip()

    # 3. Subtotal
    patron_subtotal = re.search(r'\b(?:SUBTOTAL|Sub[\s-]*total)[\s.:]*\$?\s*([0-9\.,]+)', texto, re.IGNORECASE)
    if patron_subtotal:
        datos["Subtotal"] = patron_subtotal.group(1).strip()

    # 4. IVA (Soporta formatos como IVA: $100, IVA (19%): 100.000, I.V.A.: $50)
    patron_iva = re.search(r'(?:IVA|I\.V\.A\.|Impuesto)(?:\s*\([^)]*\))?[\s.:]*\$?\s*([0-9\.,]+)', texto, re.IGNORECASE)
    if patron_iva:
        datos["IVA"] = patron_iva.group(1).strip()

    # 5. Total (Se asegura con \b y no emparejar SUBTOTAL)
    patron_total = re.search(r'(?<!SUB)\b(?:TOTAL|Total|Gran[\s]*Total|Valor[\s]*Total)[\s.:]*\$?\s*([0-9\.,]+)', texto, re.IGNORECASE)
    if patron_total:
        datos["Total"] = patron_total.group(1).strip()

    return datos

# ==============================================================================
# PASO 4: GENERACIÓN DEL ARCHIVO XML (xml.etree.ElementTree)
# ==============================================================================
def generar_xml_factura(datos: dict, ruta_salida_xml: str):
    """
    Crea un árbol XML jerárquico con las etiquetas básicas para los datos
    capturados y guarda el archivo .xml resultante en el disco.
    """
    # 1. Crear el elemento raíz <Factura>
    raiz = ET.Element("Factura")

    # 2. Crear las etiquetas hijas con los valores correspondientes
    nodo_nit = ET.SubElement(raiz, "NIT")
    nodo_nit.text = datos.get("NIT", "N/A")

    nodo_fecha = ET.SubElement(raiz, "Fecha")
    nodo_fecha.text = datos.get("Fecha", "N/A")

    nodo_subtotal = ET.SubElement(raiz, "Subtotal")
    nodo_subtotal.text = datos.get("Subtotal", "N/A")

    nodo_iva = ET.SubElement(raiz, "IVA")
    nodo_iva.text = datos.get("IVA", "N/A")

    nodo_total = ET.SubElement(raiz, "Total")
    nodo_total.text = datos.get("Total", "N/A")

    # 3. Construir el árbol XML
    arbol = ET.ElementTree(raiz)

    # 4. Aplicar sangría (indentación) para una estructura legible
    if hasattr(ET, 'indent'):
        ET.indent(arbol, space="  ", level=0)

    # 5. Guardar el archivo en formato UTF-8
    arbol.write(ruta_salida_xml, encoding="utf-8", xml_declaration=True)
    print(f"[+] Archivo XML generado exitosamente en: '{os.path.abspath(ruta_salida_xml)}'")

# ==============================================================================
# ORQUESTACIÓN PRINCIPAL
# ==============================================================================
def procesar_factura(ruta_imagen: str, ruta_salida_xml: str = "factura_procesada.xml"):
    """
    Función principal que ejecuta secuencialmente los 4 pasos solicitados.
    """
    print(f"[*] [Paso 1/4] Cargando y preprocesando imagen '{ruta_imagen}' con OpenCV (cv2)...")
    imagen_procesada = preprocesar_imagen(ruta_imagen)

    print("[*] [Paso 2/4] Extrayendo texto con Tesseract OCR (pytesseract)...")
    texto_extraido = extraer_texto_ocr(imagen_procesada)

    print("\n" + "="*60)
    print("--- TEXTO RECONOCIDO POR EL OCR ---")
    print("="*60)
    print(texto_extraido.strip() if texto_extraido.strip() else "[No se extrajo texto de la imagen]")
    print("="*60 + "\n")

    print("[*] [Paso 3/4] Analizando texto con Expresiones Regulares (re)...")
    datos_factura = analizar_texto_factura(texto_extraido)
    
    print("[+] Datos capturados:")
    for campo, valor in datos_factura.items():
        print(f"    - {campo}: {valor}")

    print("\n[*] [Paso 4/4] Generando archivo XML con xml.etree.ElementTree...")
    generar_xml_factura(datos_factura, ruta_salida_xml)

if __name__ == "__main__":
    # Permite recibir la ruta de la imagen desde la línea de comandos
    if len(sys.argv) > 1:
        imagen_input = sys.argv[1]
    else:
        imagen_input = "factura_ejemplo.png"

    xml_output = "factura_procesada.xml"

    if os.path.exists(imagen_input):
        procesar_factura(imagen_input, xml_output)
    else:
        print(f"[-] No se encontró el archivo de imagen '{imagen_input}'.")
        print("💡 Para probar el script, ejecuta:")
        print("   python procesar_factura.py <ruta_de_tu_imagen>")
