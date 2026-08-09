import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import { getSupabaseClient } from '@/lib/supabase';

function generarXmlString(datos: Record<string, string>): string {
  const nit = datos.NIT || 'N/A';
  const fecha = datos.Fecha || 'N/A';
  const subtotal = datos.Subtotal || 'N/A';
  const iva = datos.IVA || 'N/A';
  const total = datos.Total || 'N/A';

  return `<?xml version="1.0" encoding="UTF-8"?>
<Factura>
  <NIT>${nit}</NIT>
  <Fecha>${fecha}</Fecha>
  <Subtotal>${subtotal}</Subtotal>
  <IVA>${iva}</IVA>
  <Total>${total}</Total>
</Factura>`;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const geminiApiKeyInput = formData.get('gemini_api_key') as string | null;

    if (!file) {
      return NextResponse.json({ success: false, detail: 'No se envió ningún archivo de imagen.' }, { status: 400 });
    }

    const apiKeyToUse = geminiApiKeyInput?.trim() || process.env.GEMINI_API_KEY || '';

    if (!apiKeyToUse) {
      return NextResponse.json({
        success: false,
        detail: 'Se requiere una clave de API de Google Gemini (GEMINI_API_KEY). Ingresa tu API Key en la pantalla o en las variables de entorno de Vercel.'
      }, { status: 400 });
    }

    // Convertir archivo a Buffer / Uint8Array
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Inicializar cliente Google GenAI
    const ai = new GoogleGenAI({ apiKey: apiKeyToUse });

    const prompt = (
      "Eres un contador experto de minimarket. Analiza detalladamente esta foto de factura de compra o recibo de proveedor. " +
      "Extrae exactamente el NIT del proveedor, la Fecha de emisión de la factura, el Subtotal de la mercancía, el IVA (impuesto) y el TOTAL a pagar. " +
      "Devuelve un formato JSON estricto con los campos: NIT, Fecha, Subtotal, IVA, Total y TextoExtraido."
    );

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          inlineData: {
            mimeType: file.type || 'image/jpeg',
            data: buffer.toString('base64'),
          },
        },
        { text: prompt },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            NIT: { type: Type.STRING },
            Fecha: { type: Type.STRING },
            Subtotal: { type: Type.STRING },
            IVA: { type: Type.STRING },
            Total: { type: Type.STRING },
            TextoExtraido: { type: Type.STRING },
          },
          required: ['NIT', 'Fecha', 'Subtotal', 'IVA', 'Total'],
        },
      },
    });

    const responseText = response.text || '{}';
    const datosJson = JSON.parse(responseText);

    const fields = {
      NIT: datosJson.NIT || 'N/A',
      Fecha: datosJson.Fecha || 'N/A',
      Subtotal: datosJson.Subtotal || 'N/A',
      IVA: datosJson.IVA || 'N/A',
      Total: datosJson.Total || 'N/A',
    };

    const xmlContent = generarXmlString(fields);
    const rawText = datosJson.TextoExtraido || '[Analizado exitosamente con Google Gemini 2.5 Flash Vision AI]';

    // Guardar en Supabase si está disponible
    let guardadoEnSupabase = false;
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('facturas').insert({
          nit: fields.NIT,
          fecha: fields.Fecha,
          subtotal: fields.Subtotal,
          iva: fields.IVA,
          total: fields.Total,
          texto_extraido: rawText,
          xml_content: xmlContent,
        });
        guardadoEnSupabase = true;
      } catch (errDb) {
        console.error('Error al guardar en Supabase:', errDb);
      }
    }

    const imageOriginalB64 = `data:${file.type || 'image/jpeg'};base64,${buffer.toString('base64')}`;

    return NextResponse.json({
      success: true,
      filename: file.name,
      motor_usado: '🤖 Google Gemini AI Vision API (Next.js & Vercel)',
      guardado_en_supabase: guardadoEnSupabase,
      raw_text: rawText,
      fields,
      imagen_original_b64: imageOriginalB64,
      xml_content: xmlContent,
    });

  } catch (error: any) {
    console.error('Error en API Next.js:', error);
    return NextResponse.json({
      success: false,
      detail: error.message || 'Error procesando la imagen con Google Gemini AI.'
    }, { status: 500 });
  }
}
