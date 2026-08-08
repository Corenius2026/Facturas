from PIL import Image, ImageDraw, ImageFont
import os

def crear_imagen_factura_ejemplo(filename="factura_ejemplo.png"):
    # Crear una imagen blanca simulando papel de factura (800x1000)
    width, height = 800, 1000
    image = Image.new('RGB', (width, height), color=(255, 255, 255))
    draw = ImageDraw.Draw(image)

    # Texto simulado de la factura
    lineas_texto = [
        "COMERCIALIZADORA DE PRUEBA S.A.S.",
        "NIT: 900.876.543-1",
        "Factura de Venta No. FE-001234",
        "Fecha: 15/10/2025",
        "-----------------------------------------",
        "CANT   DESCRIPCION            VALOR",
        " 2     Servicio de Consultoria $500,000",
        " 1     Licencia de Software   $300,000",
        "-----------------------------------------",
        "SUBTOTAL: $800,000",
        "IVA (19%): $152,000",
        "TOTAL: $952,000",
        "-----------------------------------------",
        "GRACIAS POR SU COMPRA"
    ]

    y_text = 60
    for linea in lineas_texto:
        draw.text((80, y_text), linea, fill=(0, 0, 0))
        y_text += 45

    image.save(filename)
    print(f"[+] Imagen de prueba generada exitosamente: {os.path.abspath(filename)}")

if __name__ == "__main__":
    crear_imagen_factura_ejemplo()
