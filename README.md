# 🛒 Minimarket POS AI - Next.js 14 + React + Supabase + Google Gemini AI

Sistema Fullstack inteligente de lectura de facturas de compras para minimarkets. Desarrollado en **Next.js 14 (App Router)**, **React**, **TailwindCSS**, **Supabase** y la API oficial de **Google Gemini AI Vision** (`gemini-2.5-flash`).

---

## ✨ Características Principales

- **⚛️ Arquitectura Fullstack Next.js 14:** React + TypeScript + App Router con API Routes protegidas en el servidor.
- **🤖 Visión por Inteligencia Artificial:** Análisis de imágenes con el SDK oficial `@google/genai` (Google Gemini 2.5 Flash).
- **🗄️ Persistencia de Datos con Supabase:** Registra automáticamente el historial de facturas procesadas (`NIT`, `Fecha`, `Subtotal`, `IVA`, `Total`, `XML`) en PostgreSQL.
- **🎨 Interfaz POS de Minimarket:** Maquetación comercial en modo oscuro con **TailwindCSS**, iconos **Lucide** e indicadores interactivos.
- **⚡ Despliegue Nativo en Vercel:** Despliegue automático en 1 solo clic en Vercel con respuesta instantánea global.

---

## 🛠️ Variables de Entorno Recomendadas (en Vercel)

| Variable | Descripción |
| :--- | :--- |
| `GEMINI_API_KEY` | Clave de API de [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `NEXT_PUBLIC_SUPABASE_URL` | URL de tu proyecto en Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | API Key pública (Anon Key) de tu proyecto en Supabase |

---

## 🚀 Despliegue en Vercel en 1 Clic

1. Sube tu proyecto a GitHub.
2. Ingresa a **[Vercel.com](https://vercel.com)**.
3. Importa este repositorio (`Corenius2026/Facturas`).
4. Configura tus Variables de Entorno en el panel de Vercel.
5. Haz clic en **Deploy**.

---

## 🗄️ Esquema de Base de Datos para Supabase (`supabase_schema.sql`)

Ejecuta el siguiente código en el **SQL Editor** de Supabase para inicializar la tabla de facturas:

```sql
CREATE TABLE IF NOT EXISTS facturas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nit VARCHAR(50) NOT NULL DEFAULT 'N/A',
    fecha VARCHAR(50) NOT NULL DEFAULT 'N/A',
    subtotal VARCHAR(50) DEFAULT 'N/A',
    iva VARCHAR(50) DEFAULT 'N/A',
    total VARCHAR(50) DEFAULT 'N/A',
    texto_extraido TEXT,
    xml_content TEXT NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE facturas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir lectura publica de facturas" ON facturas FOR SELECT USING (true);
CREATE POLICY "Permitir insercion publica de facturas" ON facturas FOR INSERT WITH CHECK (true);
```

---

## 💻 Desarrollo Local

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor de desarrollo Next.js
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.
