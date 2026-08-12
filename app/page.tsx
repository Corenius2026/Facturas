'use client';

import React, { useState, useEffect } from 'react';
import { Store } from 'lucide-react';
import { optimizeInvoiceImage } from '@/lib/image-optimizer';
import {
  generarEstructuraSiigo,
  downloadXmlBlob,
  downloadSiigoZipPackage,
  downloadSiigoCsvTemplate,
} from '@/lib/siigo-xml';
import {
  FacturaDatos,
  ProductoItem,
  EmpresaGuardada,
  SupabaseInvoice,
  ImageOptimizationStats,
  DuplicateNotice,
  ToastNotification as ToastType,
  ProcesarApiResponse,
} from '@/types/invoice';

import { ToastNotification } from '@/components/ToastNotification';
import { CompanySelector } from '@/components/CompanySelector';
import { UploadDropzone } from '@/components/UploadDropzone';
import { ProcessingStatus } from '@/components/ProcessingStatus';
import { InvoiceSummary } from '@/components/InvoiceSummary';
import { ProductTable } from '@/components/ProductTable';
import { InvoiceHistory } from '@/components/InvoiceHistory';

export default function MinimarketPOSPage() {
  // Estado de Archivo y Optimización
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [optimizationStats, setOptimizationStats] = useState<ImageOptimizationStats | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Estado Multi-Empresa
  const [buyerNit, setBuyerNit] = useState<string>('');
  const [buyerName, setBuyerName] = useState<string>('');
  const [savedCompanies, setSavedCompanies] = useState<EmpresaGuardada[]>([]);

  // Estado de Factura Procesada
  const [fields, setFields] = useState<FacturaDatos | null>(null);
  const [productos, setProductos] = useState<ProductoItem[]>([]);
  const [rawText, setRawText] = useState<string>('');
  const [xmlContent, setXmlContent] = useState<string>('');
  const [zipFilename, setZipFilename] = useState<string>('');
  const [xmlFilenameInside, setXmlFilenameInside] = useState<string>('');
  const [pdfFilenameInside, setPdfFilenameInside] = useState<string>('');
  const [duplicateNotice, setDuplicateNotice] = useState<DuplicateNotice | null>(null);

  // Estado de Historial
  const [history, setHistory] = useState<SupabaseInvoice[]>([]);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Alertas / Toasts
  const [toast, setToast] = useState<ToastType | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Cargar empresas guardadas de localStorage al iniciar
  useEffect(() => {
    try {
      const saved = localStorage.getItem('siigo_saved_companies');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSavedCompanies(parsed);
          setBuyerNit(parsed[0].nit);
          setBuyerName(parsed[0].nombre);
        }
      } else {
        const defaultCompany = { nit: '901584216', nombre: 'MI EMPRESA SAS' };
        setSavedCompanies([defaultCompany]);
        setBuyerNit(defaultCompany.nit);
        setBuyerName(defaultCompany.nombre);
        localStorage.setItem('siigo_saved_companies', JSON.stringify([defaultCompany]));
      }
    } catch (e) {
      console.warn('Error leyendo empresas de localStorage:', e);
    }
  }, []);

  // Cargar historial de Supabase
  const loadHistory = async (targetBuyerNit?: string) => {
    try {
      const nitToFilter = (targetBuyerNit !== undefined ? targetBuyerNit : buyerNit).trim();
      const url = nitToFilter
        ? `/api/facturas?buyer_nit=${encodeURIComponent(nitToFilter)}`
        : '/api/facturas';

      const res = await fetch(url);
      const data = await res.json();
      if (data.success && Array.isArray(data.facturas)) {
        setHistory(data.facturas);
      }
    } catch (err) {
      console.error('Error cargando historial de compras:', err);
    }
  };

  useEffect(() => {
    if (buyerNit) {
      loadHistory(buyerNit);
    }
  }, [buyerNit]);

  // Manejo de Selección de Archivo con Optimización Inteligente
  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('Por favor selecciona un archivo de imagen válido (JPG, PNG, WebP)', 'error');
      return;
    }

    try {
      showToast('Optimizando imagen...', 'warning');
      const optResult = await optimizeInvoiceImage(file, 1800, 0.84);

      setSelectedFile(optResult.file);
      setPreviewUrl(URL.createObjectURL(optResult.file));
      setOptimizationStats(optResult.stats);
      setDuplicateNotice(null);

      showToast(
        `Imagen optimizada: ${(optResult.stats.originalSize / 1024).toFixed(0)} KB → ${(optResult.stats.optimizedSize / 1024).toFixed(0)} KB (-${optResult.stats.reductionPercentage}%)`,
        'success'
      );
    } catch (err: any) {
      console.error('Error al optimizar imagen en cliente:', err);
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setOptimizationStats(null);
      showToast('No se pudo comprimir la imagen en el cliente, se enviará original', 'warning');
    }
  };

  // Procesar Factura (Llamada al Endpoint con Idempotencia)
  const processInvoice = async () => {
    if (!selectedFile || isProcessing) return;

    setIsProcessing(true);
    showToast('Analizando factura con IA y generando estructura para Siigo...', 'warning');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      if (buyerNit.trim()) formData.append('buyer_nit', buyerNit.trim());
      if (buyerName.trim()) formData.append('buyer_name', buyerName.trim());

      const res = await fetch('/api/procesar', {
        method: 'POST',
        body: formData,
      });

      const result: ProcesarApiResponse = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.detail || 'Error al procesar la factura.');
      }

      if (!buyerNit && result.fields?.BuyerNIT) {
        setBuyerNit(result.fields.BuyerNIT);
      }
      if (!buyerName && result.fields?.BuyerName) {
        setBuyerName(result.fields.BuyerName);
      }

      const activeBuyerNit = buyerNit.trim() || result.fields?.BuyerNIT || '901584216';
      const activeBuyerName = buyerName.trim() || result.fields?.BuyerName || 'MI EMPRESA SAS';

      const fullFields: FacturaDatos = {
        NIT: result.fields?.NIT || 'N/A',
        NombreProveedor: result.fields?.NombreProveedor || '',
        BuyerNIT: activeBuyerNit,
        BuyerName: activeBuyerName,
        Fecha: result.fields?.Fecha || 'N/A',
        Subtotal: String(result.fields?.Subtotal || '0'),
        IVA: String(result.fields?.IVA || '0'),
        Total: String(result.fields?.Total || '0'),
        Productos: result.productos || result.fields?.Productos || [],
      };

      setFields(fullFields);
      setProductos(fullFields.Productos);
      setRawText(result.raw_text || '');

      // Generar XML exacto sincronizado con la empresa activa
      const est = await generarEstructuraSiigo(fullFields, result.numero_factura);
      setXmlContent(est.attachedXml);
      setZipFilename(est.zipFilename);
      setXmlFilenameInside(est.xmlFilenameInside);
      setPdfFilenameInside(est.pdfFilenameInside);

      if (result.duplicate) {
        setDuplicateNotice({
          isDuplicate: true,
          type: result.duplicate_type,
          message: result.message,
        });
        showToast(result.message || 'Factura ya registrada previamente.', 'warning');
      } else {
        setDuplicateNotice(null);
        showToast('¡Factura analizada e integrada con éxito!', 'success');
      }
      loadHistory();
    } catch (err: any) {
      showToast(err.message || 'Error en el procesamiento de la factura', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Descargar XML desde el Historial bajo demanda
  const downloadHistoryXml = async (invoiceId: string, nit: string) => {
    try {
      showToast('Recuperando XML de la factura...', 'warning');
      const res = await fetch(`/api/facturas?id=${encodeURIComponent(invoiceId)}`);
      const data = await res.json();

      if (!res.ok || !data.success || !data.factura?.xml_content) {
        throw new Error(data.error || 'No se encontró el XML de esta factura en Supabase.');
      }

      downloadXmlBlob(data.factura.xml_content, `factura_${nit}_${invoiceId.substring(0, 8)}.xml`);
      showToast('Archivo XML descargado con éxito', 'success');
    } catch (err: any) {
      console.error('Error al descargar XML bajo demanda:', err);
      showToast(err.message || 'Error al descargar el XML de la factura', 'error');
    }
  };

  // Guardar y Eliminar Empresas
  const saveCurrentCompany = () => {
    const nit = buyerNit.trim().replace(/[^0-9]/g, '');
    const nombre = buyerName.trim();
    if (!nit || !nombre) {
      showToast('Por favor completa tanto el NIT como la Razón Social', 'warning');
      return;
    }
    const updated = savedCompanies.filter((c) => c.nit !== nit);
    updated.unshift({ nit, nombre });
    setSavedCompanies(updated);
    localStorage.setItem('siigo_saved_companies', JSON.stringify(updated));
    showToast(`Empresa "${nombre}" guardada`, 'success');
  };

  const deleteSavedCompany = (nit: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedCompanies.filter((c) => c.nit !== nit);
    setSavedCompanies(updated);
    localStorage.setItem('siigo_saved_companies', JSON.stringify(updated));
    if (buyerNit === nit && updated.length > 0) {
      setBuyerNit(updated[0].nit);
      setBuyerName(updated[0].nombre);
    }
    showToast('Empresa eliminada de la lista', 'warning');
  };

  // Eliminación de Facturas
  const handleDeleteSelected = async (targetIds?: string[]) => {
    const idsToDelete = targetIds || selectedInvoiceIds;
    if (idsToDelete.length === 0) {
      showToast('Selecciona al menos una factura para eliminar', 'warning');
      return;
    }

    if (!confirm(`¿Estás seguro de que deseas eliminar ${idsToDelete.length} factura(s)?`)) {
      return;
    }

    setIsDeleting(true);
    showToast('Eliminando registros seleccionados...', 'warning');

    try {
      const res = await fetch('/api/facturas', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: idsToDelete, buyer_nit: buyerNit.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Error al eliminar registros.');
      }

      showToast(data.message || 'Factura(s) eliminada(s) con éxito', 'success');
      setSelectedInvoiceIds((prev) => prev.filter((id) => !idsToDelete.includes(id)));
      loadHistory();
    } catch (err: any) {
      showToast(err.message || 'Error al eliminar las facturas', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F5F9FC] text-[#001D39] p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Bar */}
        <header className="bg-gradient-to-r from-[#001D39] to-[#0A4174] border border-[#0A4174] rounded-2xl p-6 shadow-lg text-white">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-white/10 rounded-2xl border border-white/20 shadow-inner">
                <Store className="w-8 h-8 text-[#7BBDE8]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl md:text-2xl font-black tracking-tight">Analizador de Facturas</h1>
                  <span className="text-[10px] uppercase font-bold tracking-wider bg-[#7BBDE8] text-[#001D39] px-2 py-0.5 rounded-full shadow-sm">
                    UBL 2.1 Siigo
                  </span>
                </div>
                <p className="text-xs text-[#BDD8E9] mt-0.5">
                  Extracción con Google Gemini AI, generación de ZIP/XML UBL 2.1 e integración multi-empresa
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-white/10 border border-white/20 px-3.5 py-2 rounded-xl text-right">
                <span className="block text-[10px] text-[#BDD8E9] uppercase font-bold">Empresa Activa</span>
                <span className="font-bold text-xs text-white truncate max-w-[180px] inline-block">
                  {buyerName || 'MI EMPRESA'}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Top Section: Multi-Company Configuration */}
        <CompanySelector
          buyerNit={buyerNit}
          buyerName={buyerName}
          savedCompanies={savedCompanies}
          onBuyerNitChange={setBuyerNit}
          onBuyerNameChange={setBuyerName}
          onSaveCompany={saveCurrentCompany}
          onSelectCompany={(comp) => {
            setBuyerNit(comp.nit);
            setBuyerName(comp.nombre);
            showToast(`Empresa seleccionada: ${comp.nombre}`, 'success');
          }}
          onDeleteCompany={deleteSavedCompany}
        />

        {/* Main Processing Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Upload Dropzone */}
          <div className="lg:col-span-5 space-y-6">
            <UploadDropzone
              selectedFile={selectedFile}
              previewUrl={previewUrl}
              isProcessing={isProcessing}
              optimizationStats={optimizationStats}
              onFileSelect={handleFileSelect}
              onProcessInvoice={processInvoice}
            />
          </div>

          {/* Right Column: Extracted Results & Tables */}
          <section className="lg:col-span-7 space-y-6 relative">
            <ProcessingStatus
              isProcessing={isProcessing}
              buyerNit={buyerNit}
              duplicateNotice={duplicateNotice}
            />

            {fields && (
              <>
                <InvoiceSummary
                  fields={fields}
                  buyerName={buyerName}
                  buyerNit={buyerNit}
                  zipFilename={zipFilename}
                  onDownloadZip={() => {
                    if (!fields || !xmlContent) return;
                    downloadSiigoZipPackage(fields, xmlContent, zipFilename, xmlFilenameInside, pdfFilenameInside);
                    showToast(`¡Paquete ${zipFilename} descargado!`, 'success');
                  }}
                  onDownloadXml={() => {
                    downloadXmlBlob(xmlContent, xmlFilenameInside || 'factura_dian.xml');
                    showToast('Archivo XML UBL 2.1 descargado', 'success');
                  }}
                  onCopyXml={() => {
                    if (!xmlContent) return;
                    navigator.clipboard.writeText(xmlContent);
                    showToast('XML UBL 2.1 copiado al portapapeles', 'success');
                  }}
                  onDownloadCsv={() => {
                    if (!fields) return;
                    downloadSiigoCsvTemplate(fields, productos);
                    showToast('Plantilla CSV para Siigo descargada', 'success');
                  }}
                />

                <ProductTable productos={productos} />
              </>
            )}
          </section>
        </div>

        {/* Bottom Section: Purchases History */}
        <InvoiceHistory
          history={history}
          selectedInvoiceIds={selectedInvoiceIds}
          isDeleting={isDeleting}
          buyerNit={buyerNit}
          onSelectAll={() => {
            if (selectedInvoiceIds.length === history.length) {
              setSelectedInvoiceIds([]);
            } else {
              setSelectedInvoiceIds(history.map((item) => item.id));
            }
          }}
          onToggleSelect={(id) => {
            setSelectedInvoiceIds((prev) =>
              prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
            );
          }}
          onDeleteSelected={handleDeleteSelected}
          onRefreshHistory={() => loadHistory()}
          onDownloadXml={downloadHistoryXml}
        />
      </div>

      {/* Toast Alert Notification */}
      <ToastNotification toast={toast} />
    </main>
  );
}
