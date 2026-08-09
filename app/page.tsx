'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Building2,
  UploadCloud,
  FileText,
  Database,
  Calendar,
  Package,
  Tag,
  DollarSign,
  Copy,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ListOrdered,
  FileCheck2,
  Store
} from 'lucide-react';

interface ProductoItem {
  cantidad: string;
  descripcion: string;
  precio_unitario: string;
  total_item: string;
}

interface InvoiceFields {
  NIT: string;
  Fecha: string;
  Subtotal: string;
  IVA: string;
  Total: string;
  Productos?: ProductoItem[];
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
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'image' | 'text'>('image');

  const [fields, setFields] = useState<InvoiceFields | null>(null);
  const [productos, setProductos] = useState<ProductoItem[]>([]);
  const [rawText, setRawText] = useState<string>('');
  const [xmlContent, setXmlContent] = useState<string>('');
  const [engineUsed, setEngineUsed] = useState<string>('');

  const [history, setHistory] = useState<SupabaseInvoice[]>([]);
  const [isDbConnected, setIsDbConnected] = useState<boolean>(false);

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
      showToast('Por favor selecciona una imagen válida de la factura (.png, .jpg)', 'warning');
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
      setProductos(result.productos || result.fields?.Productos || []);
      setRawText(result.raw_text);
      setXmlContent(result.xml_content);
      setEngineUsed(result.motor_usado);

      showToast('Factura analizada e integrada exitosamente', 'success');
      loadHistory();
    } catch (err: any) {
      showToast(err.message || 'Error en el procesamiento de la factura', 'error');
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
    ctx.fillStyle = '#001D39';
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
      '¡GRACIAS POR SU COMPRA!'
    ];

    let y = 70;
    lineas.forEach(l => {
      ctx.fillText(l, 50, y);
      y += 42;
    });

    canvas.toBlob((blob) => {
      if (!blob) return;
      const sampleFile = new File([blob], 'factura_ejemplo_minimarket.png', { type: 'image/png' });
      setSelectedFile(sampleFile);
      setPreviewUrl(canvas.toDataURL());
      processInvoice(sampleFile);
    });
  };

  const copyXmlToClipboard = () => {
    if (!xmlContent) return;
    navigator.clipboard.writeText(xmlContent);
    showToast('Estructura XML copiada al portapapeles', 'success');
  };

  const downloadXmlFile = (xmlStr?: string, filename?: string) => {
    const content = xmlStr || xmlContent;
    if (!content) return;
    const blob = new Blob([content], { type: 'application/xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || (selectedFile ? selectedFile.name.replace(/\.[^/.]+$/, '') + '.xml' : 'factura_siigo.xml');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Archivo XML descargado correctamente', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-lg border shadow-xl backdrop-blur-md text-sm font-semibold transition-all ${
          toast.type === 'error' ? 'bg-[#0A4174] border-red-400 text-red-200' :
          toast.type === 'warning' ? 'bg-[#0A4174] border-amber-400 text-amber-200' :
          'bg-[#0A4174] border-[#4E8EA2] text-[#BDD8E9]'
        }`}>
          {toast.type === 'error' && <AlertTriangle className="w-5 h-5 text-red-400" />}
          {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400" />}
          {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-[#7BBDE8]" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Corporate Header */}
      <header className="bg-[#0A4174] border border-[#49769F]/50 rounded-xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-md">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#001D39] border border-[#4E8EA2]/40 rounded-lg flex items-center justify-center">
            <Store className="w-6 h-6 text-[#7BBDE8]" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-white tracking-tight">
                Procesador de Facturas POS
              </h1>
              <span className="bg-[#001D39] border border-[#4E8EA2]/50 text-[#7BBDE8] text-xs font-semibold px-2.5 py-0.5 rounded uppercase">
                Siigo ERP Ready
              </span>
            </div>
            <p className="text-[#BDD8E9] text-xs mt-0.5">Extracción automática de datos de compra e inventario para minimarket</p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-[#001D39]/80 border border-[#49769F]/40 px-4 py-2 rounded-lg text-xs">
          <Database className="w-4 h-4 text-[#7BBDE8]" />
          <div>
            <span className="block text-[#6EA2B3] text-[10px] uppercase font-bold">Base de Datos</span>
            <span className="font-semibold text-white">{isDbConnected ? 'Supabase Conectado' : 'Modo Local'}</span>
          </div>
        </div>
      </header>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Upload */}
        <section className="lg:col-span-5 bg-[#0A4174] border border-[#49769F]/50 rounded-xl p-6 shadow-md space-y-5">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-[#7BBDE8]" />
              Cargar Documento de Compra
            </h2>
            <p className="text-xs text-[#BDD8E9] mt-1">Selecciona la imagen de la factura física para procesar encabezados y productos.</p>
          </div>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[#49769F] hover:border-[#7BBDE8] bg-[#001D39]/40 hover:bg-[#001D39]/70 transition-all rounded-xl p-8 text-center cursor-pointer relative"
          >
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            />
            <div className="w-12 h-12 bg-[#0A4174] border border-[#4E8EA2]/40 rounded-full flex items-center justify-center mx-auto mb-3 text-[#7BBDE8]">
              <UploadCloud className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-sm text-white">Arrastra la factura aquí</h3>
            <p className="text-xs text-[#BDD8E9] mt-1">o <span className="text-[#7BBDE8] font-semibold underline">selecciona un archivo</span> (.jpg, .png)</p>
            
            {selectedFile && (
              <div className="mt-4 inline-flex items-center gap-2 bg-[#001D39] border border-[#4E8EA2] text-[#7BBDE8] px-3 py-1 rounded text-xs font-medium">
                <FileText className="w-4 h-4" />
                <span>{selectedFile.name}</span>
              </div>
            )}
          </div>

          <div className="space-y-2.5">
            <button
              onClick={() => processInvoice()}
              disabled={!selectedFile || isProcessing}
              className="w-full bg-[#4E8EA2] hover:bg-[#6EA2B3] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg shadow transition-all flex items-center justify-center gap-2 text-sm"
            >
              <span>{isProcessing ? 'Procesando Documento...' : 'Procesar Factura para Siigo'}</span>
            </button>

            <button
              onClick={loadSampleInvoice}
              disabled={isProcessing}
              className="w-full bg-[#001D39] hover:bg-[#001D39]/80 border border-[#49769F] text-[#BDD8E9] font-medium py-2.5 px-4 rounded-lg text-xs flex items-center justify-center gap-2 transition-all"
            >
              📄 Cargar Factura de Ejemplo
            </button>
          </div>
        </section>

        {/* Right Column: Extracted Results */}
        <section className="lg:col-span-7 space-y-6 relative">
          {/* Loader Overlay */}
          {isProcessing && (
            <div className="absolute inset-0 bg-[#001D39]/90 border border-[#49769F] rounded-xl z-40 flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 border-3 border-[#49769F] border-t-[#7BBDE8] rounded-full animate-spin flex items-center justify-center">
              </div>
              <h3 className="font-bold text-sm text-white">Extrayendo Datos y Productos para Siigo...</h3>
              <p className="text-xs text-[#BDD8E9]">Analizando proveedor, precios e ítems del recibo...</p>
            </div>
          )}

          {!fields ? (
            <div className="bg-[#0A4174] border border-[#49769F]/50 rounded-xl p-12 text-center text-[#BDD8E9]">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50 text-[#7BBDE8]" />
              <h3 className="text-base font-bold text-white mb-1">Sin Documento Seleccionado</h3>
              <p className="text-xs max-w-md mx-auto">Sube una factura comercial en el panel izquierdo para visualizar la extracción de ítems y estructura XML.</p>
            </div>
          ) : (
            <>
              {/* Header Metrics */}
              <div className="bg-[#0A4174] border border-[#49769F]/50 rounded-xl p-6 shadow-md space-y-4">
                <div className="flex justify-between items-center border-b border-[#49769F]/40 pb-3">
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    Resumen de Encabezado
                  </h2>
                  <span className="text-xs text-[#7BBDE8] font-mono">
                    {engineUsed}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#001D39] border border-[#49769F]/40 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 text-xs text-[#6EA2B3] mb-1">
                      <Building2 className="w-3.5 h-3.5" />
                      <span>NIT Proveedor</span>
                    </div>
                    <span className="text-sm font-bold text-white block">{fields.NIT}</span>
                  </div>

                  <div className="bg-[#001D39] border border-[#49769F]/40 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 text-xs text-[#6EA2B3] mb-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Fecha Emisión</span>
                    </div>
                    <span className="text-sm font-bold text-white block">{fields.Fecha}</span>
                  </div>

                  <div className="bg-[#001D39] border border-[#49769F]/40 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 text-xs text-[#6EA2B3] mb-1">
                      <Package className="w-3.5 h-3.5" />
                      <span>Subtotal</span>
                    </div>
                    <span className="text-sm font-bold text-white block">${fields.Subtotal}</span>
                  </div>

                  <div className="bg-[#001D39] border border-[#49769F]/40 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 text-xs text-[#6EA2B3] mb-1">
                      <Tag className="w-3.5 h-3.5" />
                      <span>IVA</span>
                    </div>
                    <span className="text-sm font-bold text-white block">${fields.IVA}</span>
                  </div>

                  <div className="col-span-2 bg-[#001D39] border border-[#4E8EA2] rounded-lg p-3 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#7BBDE8] uppercase">
                      <DollarSign className="w-4 h-4" />
                      <span>TOTAL FACTURA</span>
                    </div>
                    <span className="text-xl font-extrabold text-[#7BBDE8]">${fields.Total}</span>
                  </div>
                </div>
              </div>

              {/* Products Table */}
              <div className="bg-[#0A4174] border border-[#49769F]/50 rounded-xl p-6 shadow-md space-y-4">
                <div className="flex justify-between items-center border-b border-[#49769F]/40 pb-3">
                  <h2 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider">
                    <ListOrdered className="w-4 h-4 text-[#7BBDE8]" />
                    Detalle de Productos (Siigo ERP)
                  </h2>
                  <span className="bg-[#001D39] text-[#7BBDE8] text-xs font-bold px-2.5 py-0.5 rounded border border-[#4E8EA2]/40">
                    {productos.length} Ítems
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#001D39] text-[#6EA2B3] uppercase font-bold text-[11px] border-b border-[#49769F]/50">
                        <th className="p-2.5">Cant</th>
                        <th className="p-2.5">Descripción del Producto</th>
                        <th className="p-2.5">Precio Unit.</th>
                        <th className="p-2.5 text-right">Total Ítem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#49769F]/30">
                      {productos.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-4 text-center text-[#BDD8E9]">
                            No se registraron productos en el detalle.
                          </td>
                        </tr>
                      ) : (
                        productos.map((prod, idx) => (
                          <tr key={idx} className="hover:bg-[#001D39]/40 transition-colors">
                            <td className="p-2.5 font-bold text-[#7BBDE8]">{prod.cantidad || '1'}</td>
                            <td className="p-2.5 font-medium text-white">{prod.descripcion}</td>
                            <td className="p-2.5 text-[#BDD8E9]">${prod.precio_unitario || '0'}</td>
                            <td className="p-2.5 text-right font-bold text-white">${prod.total_item || '0'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tabs Viewer */}
              <div className="bg-[#0A4174] border border-[#49769F]/50 rounded-xl p-6 shadow-md space-y-4">
                <div className="flex gap-2 border-b border-[#49769F]/40 pb-3">
                  <button
                    onClick={() => setActiveTab('image')}
                    className={`px-3 py-1.5 rounded font-semibold text-xs transition-all ${
                      activeTab === 'image' ? 'bg-[#001D39] text-[#7BBDE8] border border-[#4E8EA2]' : 'text-[#BDD8E9] hover:text-white'
                    }`}
                  >
                    Imagen de Origen
                  </button>
                  <button
                    onClick={() => setActiveTab('text')}
                    className={`px-3 py-1.5 rounded font-semibold text-xs transition-all ${
                      activeTab === 'text' ? 'bg-[#001D39] text-[#7BBDE8] border border-[#4E8EA2]' : 'text-[#BDD8E9] hover:text-white'
                    }`}
                  >
                    Texto Procesado
                  </button>
                </div>

                {activeTab === 'image' && previewUrl && (
                  <div className="bg-[#001D39] border border-[#49769F]/40 rounded-lg overflow-hidden max-h-72 flex items-center justify-center p-2">
                    <img src={previewUrl} alt="Factura Preview" className="max-h-64 object-contain" />
                  </div>
                )}

                {activeTab === 'text' && (
                  <pre className="bg-[#001D39] border border-[#49769F]/40 rounded-lg p-3 font-mono text-xs text-[#BDD8E9] max-h-64 overflow-y-auto leading-relaxed">
                    {rawText}
                  </pre>
                )}
              </div>

              {/* XML Block */}
              <div className="bg-[#0A4174] border border-[#49769F]/50 rounded-xl p-6 shadow-md space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[#49769F]/40 pb-3">
                  <div>
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                      Estructura XML (Compatible con Siigo)
                    </h2>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={copyXmlToClipboard}
                      className="bg-[#001D39] hover:bg-[#001D39]/80 border border-[#49769F] text-[#BDD8E9] font-medium px-3 py-1 rounded text-xs flex items-center gap-1.5 transition-all"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar</span>
                    </button>
                    <button
                      onClick={() => downloadXmlFile()}
                      className="bg-[#4E8EA2] hover:bg-[#6EA2B3] text-white font-medium px-3 py-1 rounded text-xs flex items-center gap-1.5 transition-all shadow"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Descargar XML</span>
                    </button>
                  </div>
                </div>

                <pre className="bg-[#001D39] border border-[#49769F]/40 rounded-lg p-4 font-mono text-xs text-[#7BBDE8] max-h-60 overflow-y-auto leading-relaxed">
                  {xmlContent}
                </pre>
              </div>
            </>
          )}
        </section>
      </div>

      {/* Supabase History Table */}
      <section className="bg-[#0A4174] border border-[#49769F]/50 rounded-xl p-6 shadow-md space-y-4">
        <div className="flex justify-between items-center border-b border-[#49769F]/40 pb-3">
          <div>
            <h2 className="text-base font-bold text-white">
              Historial de Facturas Procesadas
            </h2>
            <p className="text-xs text-[#BDD8E9]">Registro de compras almacenadas en la base de datos Supabase</p>
          </div>
          <button
            onClick={loadHistory}
            className="bg-[#001D39] hover:bg-[#001D39]/80 border border-[#49769F] text-[#BDD8E9] font-medium px-3 py-1.5 rounded text-xs flex items-center gap-1.5 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Actualizar</span>
          </button>
        </div>

        {!isDbConnected ? (
          <div className="bg-[#001D39]/60 border border-[#49769F]/40 rounded-lg p-4 text-xs text-[#BDD8E9] text-center">
            Persistencia automática lista. Modos local y Supabase configurados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#001D39] text-[#6EA2B3] uppercase font-bold text-[11px] border-b border-[#49769F]/50">
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Proveedor (NIT)</th>
                  <th className="p-3">Subtotal</th>
                  <th className="p-3">IVA</th>
                  <th className="p-3">TOTAL</th>
                  <th className="p-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#49769F]/30">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-[#BDD8E9]">
                      Aún no hay compras registradas en la base de datos.
                    </td>
                  </tr>
                ) : (
                  history.map((item) => (
                    <tr key={item.id} className="hover:bg-[#001D39]/40 transition-colors">
                      <td className="p-3 font-medium text-[#BDD8E9]">{item.fecha}</td>
                      <td className="p-3 font-bold text-white">{item.nit}</td>
                      <td className="p-3 text-[#BDD8E9]">${item.subtotal}</td>
                      <td className="p-3 text-[#BDD8E9]">${item.iva}</td>
                      <td className="p-3 font-extrabold text-[#7BBDE8]">${item.total}</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => downloadXmlFile(item.xml_content, `factura_${item.nit}.xml`)}
                          className="bg-[#001D39] hover:bg-[#001D39]/80 border border-[#49769F] text-[#BDD8E9] px-2.5 py-1 rounded text-xs font-medium inline-flex items-center gap-1 transition-all"
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
