'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ShoppingCart,
  UploadCloud,
  FileText,
  Sparkles,
  Database,
  Building2,
  Calendar,
  Package,
  Tag,
  DollarSign,
  Copy,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';

interface InvoiceFields {
  NIT: string;
  Fecha: string;
  Subtotal: string;
  IVA: string;
  Total: string;
}

interface SupabaseInvoice {
  id: string;
  nit: string;
  fecha: string;
  subtotal: string;
  iva: string;
  total: string;
  xml_content: string;
  creado_en: string;
}

export default function MinimarketPOSPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [geminiApiKey, setGeminiApiKey] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'image' | 'text'>('image');

  const [fields, setFields] = useState<InvoiceFields | null>(null);
  const [rawText, setRawText] = useState<string>('');
  const [xmlContent, setXmlContent] = useState<string>('');
  const [engineUsed, setEngineUsed] = useState<string>('');
  const [savedInDb, setSavedInDb] = useState<boolean>(false);

  const [history, setHistory] = useState<SupabaseInvoice[]>([]);
  const [isDbConnected, setIsDbConnected] = useState<boolean>(false);
  const [dbMessage, setDbMessage] = useState<string>('');

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadHistory = async () => {
    try {
      const res = await fetch('/api/facturas');
      const data = await res.json();
      setIsDbConnected(data.connected);
      if (data.connected && data.facturas) {
        setHistory(data.facturas);
      } else {
        setDbMessage(data.message || '');
      }
    } catch (err) {
      console.error('Error cargando historial:', err);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('Por favor selecciona una foto de factura válida (.png, .jpg)', 'warning');
      return;
    }
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const processInvoice = async (fileToProcess?: File) => {
    const targetFile = fileToProcess || selectedFile;
    if (!targetFile) return;

    setIsProcessing(true);
    const formData = new FormData();
    formData.append('file', targetFile);
    if (geminiApiKey.trim()) {
      formData.append('gemini_api_key', geminiApiKey.trim());
    }

    try {
      const res = await fetch('/api/procesar', {
        method: 'POST',
        body: formData,
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.detail || 'Error al procesar la factura.');
      }

      setFields(result.fields);
      setRawText(result.raw_text);
      setXmlContent(result.xml_content);
      setEngineUsed(result.motor_usado);
      setSavedInDb(result.guardado_en_supabase);

      showToast(`Factura procesada con éxito (${result.motor_usado})`, 'success');
      loadHistory();
    } catch (err: any) {
      showToast(err.message || 'Error de procesamiento', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const loadSampleInvoice = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 1050;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 800, 1050);
    ctx.fillStyle = '#000000';
    ctx.font = '22px monospace';

    const lineas = [
      'DISTRIBUIDORA ALIMENTOS Y BEBIDAS S.A.S.',
      'NIT: 900.876.543-1',
      'Factura de Venta No. FE-00892',
      'Fecha: 15/10/2025',
      '-----------------------------------------',
      'CANT  DESCRIPCION             VALOR',
      ' 10   Cajas Leche Entera 1L   $450,000',
      '  5   Sacos Arroz 5kg         $180,000',
      '  2   Cajas Gaseosas 1.5L     $170,000',
      '-----------------------------------------',
      'SUBTOTAL: $800,000',
      'IVA (19%): $152,000',
      'TOTAL: $952,000',
      '-----------------------------------------',
      '¡GRACIAS POR SU COMPRA MINIMARKET!'
    ];

    let y = 70;
    lineas.forEach(l => {
      ctx.fillText(l, 50, y);
      y += 42;
    });

    canvas.toBlob((blob) => {
      if (!blob) return;
      const sampleFile = new File([blob], 'factura_minimarket_ejemplo.png', { type: 'image/png' });
      setSelectedFile(sampleFile);
      setPreviewUrl(canvas.toDataURL());
      processInvoice(sampleFile);
    });
  };

  const copyXmlToClipboard = () => {
    if (!xmlContent) return;
    navigator.clipboard.writeText(xmlContent);
    showToast('XML copiado al portapapeles', 'success');
  };

  const downloadXmlFile = (xmlStr?: string, filename?: string) => {
    const content = xmlStr || xmlContent;
    if (!content) return;
    const blob = new Blob([content], { type: 'application/xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || (selectedFile ? selectedFile.name.replace(/\.[^/.]+$/, '') + '.xml' : 'factura.xml');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Archivo XML descargado', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl border shadow-2xl backdrop-blur-md text-sm font-semibold transition-all ${
          toast.type === 'error' ? 'bg-red-950/80 border-red-500 text-red-300' :
          toast.type === 'warning' ? 'bg-amber-950/80 border-amber-500 text-amber-300' :
          'bg-emerald-950/80 border-emerald-500 text-emerald-300'
        }`}>
          {toast.type === 'error' && <AlertTriangle className="w-5 h-5" />}
          {toast.type === 'warning' && <AlertTriangle className="w-5 h-5" />}
          {toast.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Component */}
      <header className="bg-[#0f172a]/85 border border-slate-700/80 backdrop-blur-lg rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-emerald-500/20 to-amber-500/20 border border-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/10">
            <ShoppingCart className="w-7 h-7 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-extrabold tracking-tight">
                Minimarket<span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">POS AI</span>
              </h1>
              <span className="bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Next.js 14 + Gemini AI
              </span>
            </div>
            <p className="text-slate-400 text-sm">Escáner Inteligente de Facturas de Proveedores para Minimarket POS</p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-slate-800/80 border border-slate-700 px-4 py-2 rounded-xl text-xs">
          <Database className="w-4 h-4 text-emerald-400" />
          <div>
            <span className="block text-slate-400 text-[10px] uppercase font-bold">Estado Supabase</span>
            <span className="font-bold text-emerald-400">{isDbConnected ? 'Conectado ✅' : 'Listo para Variables'}</span>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-[#0f172a] border border-slate-700/80 rounded-2xl p-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-slate-800 rounded-xl text-emerald-400">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <span className="block text-sm font-bold">Google Gemini 2.5 Flash</span>
            <span className="text-xs text-slate-400">IA Multimodal de Alta Precisión</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-3 bg-slate-800 rounded-xl text-cyan-400">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <span className="block text-sm font-bold">XML Automatizado</span>
            <span className="text-xs text-slate-400">Compatible con Sistemas Contables</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-3 bg-slate-800 rounded-xl text-amber-400">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <span className="block text-sm font-bold">Base de Datos POS</span>
            <span className="text-xs text-slate-400">Registro Centralizado de Compras</span>
          </div>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Upload */}
        <section className="lg:col-span-5 bg-[#0f172a] border border-slate-700/80 rounded-2xl p-6 shadow-xl space-y-5">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <span className="w-6 h-6 bg-emerald-500 text-slate-950 font-extrabold rounded-full flex items-center justify-center text-xs">1</span>
              Cargar Factura de Proveedor
            </h2>
            <p className="text-xs text-slate-400 mt-1">Sube la foto del recibo de compra de alimentos, abarrotes o bebidas.</p>
          </div>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-700 hover:border-emerald-500 hover:bg-emerald-500/5 transition-all rounded-2xl p-8 text-center cursor-pointer relative"
          >
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            />
            <div className="w-14 h-14 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3 text-emerald-400">
              <UploadCloud className="w-7 h-7" />
            </div>
            <h3 className="font-semibold text-sm">Arrastra la factura aquí</h3>
            <p className="text-xs text-slate-400 mt-1">o <span className="text-emerald-400 font-semibold underline">explora tus archivos</span> (.jpg, .png)</p>
            
            {selectedFile && (
              <div className="mt-4 inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 px-3 py-1.5 rounded-full text-xs font-semibold">
                <FileText className="w-4 h-4" />
                <span>{selectedFile.name}</span>
              </div>
            )}
          </div>

          {/* API Key Box */}
          <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 space-y-2">
            <div className="flex justify-between items-center text-xs font-semibold">
              <span>🔑 Clave de API de Google Gemini:</span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-cyan-400 hover:underline"
              >
                Obtener gratis ↗
              </a>
            </div>
            <input
              type="password"
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              placeholder="Pega tu API Key de Google (ej. AIzaSy...)"
              className="w-full bg-[#090d16] border border-slate-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 transition-all"
            />
            <p className="text-[11px] text-slate-500">También puedes configurarla como variable <code className="text-slate-300">GEMINI_API_KEY</code> en Vercel.</p>
          </div>

          <div className="space-y-2.5">
            <button
              onClick={() => processInvoice()}
              disabled={!selectedFile || isProcessing}
              className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 text-sm transition-all"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isProcessing ? 'Analizando con IA...' : 'Analizar con IA y Generar XML'}</span>
            </button>

            <button
              onClick={loadSampleInvoice}
              disabled={isProcessing}
              className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all"
            >
              🧪 Cargar Factura de Ejemplo Minimarket
            </button>
          </div>
        </section>

        {/* Right Column: Results */}
        <section className="lg:col-span-7 space-y-6 relative">
          {/* Loader Overlay */}
          {isProcessing && (
            <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-md rounded-2xl z-40 flex flex-col items-center justify-center gap-4">
              <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin-fast flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="font-bold text-base">Analizando Factura con Google Gemini AI...</h3>
              <p className="text-xs text-slate-400">Extrayendo NIT, Fecha, Subtotal, IVA y Total...</p>
            </div>
          )}

          {!fields ? (
            <div className="bg-[#0f172a] border border-slate-700/80 rounded-2xl p-12 text-center text-slate-400">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-40" />
              <h3 className="text-lg font-bold text-slate-200 mb-1">Panel de Resultados Limpio</h3>
              <p className="text-xs max-w-md mx-auto">Sube la foto de la factura del proveedor en el panel izquierdo o presiona el botón de ejemplo para ver la extracción en tiempo real.</p>
            </div>
          ) : (
            <>
              {/* Metrics Summary Card */}
              <div className="bg-[#0f172a] border border-slate-700/80 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-base font-bold flex items-center gap-2">
                    <span className="w-6 h-6 bg-emerald-500 text-slate-950 font-extrabold rounded-full flex items-center justify-center text-xs">2</span>
                    Datos Extraídos por la IA
                  </h2>
                  <span className="bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full">
                    {engineUsed}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3.5 space-y-1">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                      <Building2 className="w-4 h-4 text-emerald-400" />
                      <span>NIT del Proveedor</span>
                    </div>
                    <span className="text-base font-extrabold block">{fields.NIT}</span>
                  </div>

                  <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3.5 space-y-1">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                      <Calendar className="w-4 h-4 text-emerald-400" />
                      <span>Fecha de Emisión</span>
                    </div>
                    <span className="text-base font-extrabold block">{fields.Fecha}</span>
                  </div>

                  <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3.5 space-y-1">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                      <Package className="w-4 h-4 text-emerald-400" />
                      <span>Subtotal Mercancía</span>
                    </div>
                    <span className="text-base font-extrabold block">${fields.Subtotal}</span>
                  </div>

                  <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3.5 space-y-1">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                      <Tag className="w-4 h-4 text-emerald-400" />
                      <span>Impuesto / IVA</span>
                    </div>
                    <span className="text-base font-extrabold block">${fields.IVA}</span>
                  </div>

                  <div className="col-span-2 bg-gradient-to-r from-amber-500/10 to-emerald-500/10 border border-amber-500/40 rounded-xl p-4 space-y-1">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
                      <DollarSign className="w-4 h-4" />
                      <span>TOTAL COMPRA MINIMARKET</span>
                    </div>
                    <span className="text-2xl font-black text-amber-400 block">${fields.Total}</span>
                  </div>
                </div>
              </div>

              {/* Tabs Viewer */}
              <div className="bg-[#0f172a] border border-slate-700/80 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex gap-2 border-b border-slate-700 pb-3">
                  <button
                    onClick={() => setActiveTab('image')}
                    className={`px-4 py-2 rounded-xl font-semibold text-xs transition-all ${
                      activeTab === 'image' ? 'bg-slate-800 text-emerald-400 border border-slate-700' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    🖼️ Imagen Enviada a la IA
                  </button>
                  <button
                    onClick={() => setActiveTab('text')}
                    className={`px-4 py-2 rounded-xl font-semibold text-xs transition-all ${
                      activeTab === 'text' ? 'bg-slate-800 text-emerald-400 border border-slate-700' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    📝 Respuesta / Texto Extraído
                  </button>
                </div>

                {activeTab === 'image' && previewUrl && (
                  <div className="bg-black border border-slate-700 rounded-xl overflow-hidden max-h-80 flex items-center justify-center p-2">
                    <img src={previewUrl} alt="Factura Preview" className="max-h-72 object-contain" />
                  </div>
                )}

                {activeTab === 'text' && (
                  <pre className="bg-[#090d16] border border-slate-700 rounded-xl p-4 font-mono text-xs text-slate-300 max-h-72 overflow-y-auto leading-relaxed">
                    {rawText}
                  </pre>
                )}
              </div>

              {/* XML Code Block */}
              <div className="bg-[#0f172a] border border-slate-700/80 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h2 className="text-base font-bold flex items-center gap-2">
                      <span className="w-6 h-6 bg-emerald-500 text-slate-950 font-extrabold rounded-full flex items-center justify-center text-xs">3</span>
                      Estructura XML Creada
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">Formato XML estandarizado listo para descargar</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={copyXmlToClipboard}
                      className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar XML</span>
                    </button>
                    <button
                      onClick={() => downloadXmlFile()}
                      className="bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-semibold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Descargar .xml</span>
                    </button>
                  </div>
                </div>

                <pre className="bg-[#090d16] border border-slate-700 rounded-xl p-4 font-mono text-xs text-emerald-400 max-h-60 overflow-y-auto leading-relaxed">
                  {xmlContent}
                </pre>
              </div>
            </>
          )}
        </section>
      </div>

      {/* POS Supabase History Section */}
      <section className="bg-[#0f172a] border border-slate-700/80 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              📜 Historial de Compras (Supabase POS)
            </h2>
            <p className="text-xs text-slate-400">Registro centralizado de facturas almacenadas en la base de datos Supabase</p>
          </div>
          <button
            onClick={loadHistory}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Actualizar Historial</span>
          </button>
        </div>

        {!isDbConnected ? (
          <div className="bg-slate-800/50 border border-slate-700/80 rounded-xl p-4 text-xs text-slate-400 text-center">
            Para activar la persistencia automática de compras, configura las variables <code className="text-emerald-400">NEXT_PUBLIC_SUPABASE_URL</code> y <code className="text-emerald-400">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> en tu proyecto de Vercel.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-800 text-slate-400 uppercase font-bold text-[11px] border-b border-slate-700">
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Proveedor (NIT)</th>
                  <th className="p-3">Subtotal</th>
                  <th className="p-3">IVA</th>
                  <th className="p-3">TOTAL</th>
                  <th className="p-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-500">
                      Aún no hay compras registradas en Supabase. Procesa una factura para guardar.
                    </td>
                  </tr>
                ) : (
                  history.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 font-medium">{item.fecha}</td>
                      <td className="p-3 font-bold text-slate-200">{item.nit}</td>
                      <td className="p-3">${item.subtotal}</td>
                      <td className="p-3">${item.iva}</td>
                      <td className="p-3 font-black text-amber-400">${item.total}</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => downloadXmlFile(item.xml_content, `factura_${item.nit}.xml`)}
                          className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-2.5 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-all"
                        >
                          <Download className="w-3 h-3" />
                          <span>XML</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
