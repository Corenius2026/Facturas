from procesar_factura import analizar_texto_factura, generar_xml_factura
import os

def probar_analisis_y_xml():
    texto_simulado = """
    COMERCIALIZADORA DE PRUEBA S.A.S.
    NIT: 900.876.543-1
    Factura de Venta No. FE-001234
    Fecha: 15/10/2025
    -----------------------------------------
    CANT   DESCRIPCION            VALOR
     2     Servicio de Consultoria $500,000
     1     Licencia de Software   $300,000
    -----------------------------------------
    SUBTOTAL: $800,000
    IVA (19%): $152,000
    TOTAL: $952,000
    -----------------------------------------
    GRACIAS POR SU COMPRA
    """

    print("[*] Probando extracción de expresiones regulares...")
    datos = analizar_texto_factura(texto_simulado)
    
    print("[+] Datos capturados del texto de prueba:")
    for k, v in datos.items():
        print(f"    - {k}: {v}")

    ruta_xml = "factura_test_resultado.xml"
    generar_xml_factura(datos, ruta_xml)

    if os.path.exists(ruta_xml):
        print("\n--- CONTENIDO DEL ARCHIVO XML GENERADO ---")
        with open(ruta_xml, 'r', encoding='utf-8') as f:
            print(f.read())
        print("-------------------------------------------")

if __name__ == "__main__":
    probar_analisis_y_xml()
