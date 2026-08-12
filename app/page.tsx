'use client';

import React, { useState, useEffect } from 'react';
import { Receipt } from 'lucide-react';
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

import { AppSidebar } from '@/components/layout/AppSidebar';
import { AppHeader } from '@/components/layout/AppHeader';
import { DashboardStats } from '@/components/dashboard/DashboardStats';
import { CompanyModal } from '@/components/company/CompanyModal';
import { InvoiceUploader } from '@/components/invoice/InvoiceUploader';
import { ProcessingStatus } from '@/components/invoice/ProcessingStatus';
import { InvoiceDetailCard } from '@/components/invoice/InvoiceDetailCard';
import { InvoiceProductTable } from '@/components/invoice/InvoiceProductTable';
import { HistoryTable } from '@/components/history/HistoryTable';
import { ToastNotification } from '@/components/ToastNotification';

export default function MinimarketPOSPage() {
  // Navigation & Theme State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'uploader' | 'history'>('dashboard');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);

  // File & Optimization State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [optimizationStats, setOptimizationStats] = useState<ImageOptimizationStats | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Multi-Company State
  const [buyerNit, setBuyerNit] = useState<string>('');
  const [buyerName, setBuyerName] = useState<string>('');
  const [savedCompanies, setSavedCompanies] = useState<EmpresaGuardada[]>([]);

  // Processed Invoice State
  const [fields, setFields] = useState<FacturaDatos | null>(null);
  const [productos, setProductos] = useState<ProductoItem[]>([]);
  const [rawText, setRawText] = useState<string>('');
  const [xmlContent, setXmlContent] = useState<string>('');
  const [zipFilename, setZipFilename] = useState<string>('');
  const [xmlFilenameInside, setXmlFilenameInside] = useState<string>('');
  const [pdfFilenameInside, setPdfFilenameInside] = useState<string>('');
  const [duplicateNotice, setDuplicateNotice] = useState<DuplicateNotice | null>(null);

  // History State
  const [history, setHistory] = useState<SupabaseInvoice[]>([]);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Toast Notifications
  const [toast, setToast] = useState<ToastType | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Sync Dark Theme
  useEffect(() => {
    try {
      const storedTheme = localStorage.getItem('theme');
      if (storedTheme === 'dark' || (!storedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        setIsDark(true);
        document.documentElement.classList.add('dark');
      } else {
        setIsDark(false);
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {
      console.warn('Error syncing theme:', e);
    }
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  // Load Saved Companies from localStorage
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

  // Load History from Supabase
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

  // Handle File Selection with Client Canvas Compression
  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('Por favor selecciona un archivo de imagen válido (JPG, PNG, WebP)', 'error');
      return;
    }

    try {
      showToast('Optimizando imagen para OCR...', 'warning');
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

  // Process Invoice (Post to Backend with Idempotency)
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

  // Download XML On-Demand from History
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

  // Company Actions
  const handleSaveCompany = (nit: string, name: string) => {
    const updated = savedCompanies.filter((c) => c.nit !== nit);
    updated.unshift({ nit, nombre: name });
    setSavedCompanies(updated);
    setBuyerNit(nit);
    setBuyerName(name);
    localStorage.setItem('siigo_saved_companies', JSON.stringify(updated));
    showToast(`Empresa "${name}" guardada y activada`, 'success');
  };

  const handleDeleteCompany = (nit: string) => {
    const updated = savedCompanies.filter((c) => c.nit !== nit);
    setSavedCompanies(updated);
    localStorage.setItem('siigo_saved_companies', JSON.stringify(updated));
    if (buyerNit === nit && updated.length > 0) {
      setBuyerNit(updated[0].nit);
      setBuyerName(updated[0].nombre);
    }
    showToast('Empresa eliminada de la lista', 'warning');
  };

  // Batch Delete Actions
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

  const getPageHeaderInfo = () => {
    switch (activeTab) {
      case 'uploader':
        return {
          title: 'Analizador de Facturas con IA',
          subtitle: 'Carga una factura para extraer datos contables y generar el paquete UBL 2.1',
        };
      case 'history':
        return {
          title: 'Historial de Compras Integradas',
          subtitle: `Gestión y exportación de facturas electrónicas para NIT ${buyerNit || 'Empresa'}`,
        };
      case 'dashboard':
      default:
        return {
          title: 'Panel de Control Contable',
          subtitle: 'Resumen financiero, métricas de compras e integración con Siigo Nube',
        };
    }
  };

  const headerInfo = getPageHeaderInfo();

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row text-foreground antialiased transition-colors duration-200">
      {/* SaaS Sidebar */}
      <AppSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activeBuyerName={buyerName}
        activeBuyerNit={buyerNit}
        onOpenCompanyModal={() => setIsCompanyModalOpen(true)}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        isMobileOpen={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
      />

      {/* Main Workspace */}
      <div className="flex-1 lg:pl-72 flex flex-col min-w-0">
        {/* Sticky Header */}
        <AppHeader
          title={headerInfo.title}
          subtitle={headerInfo.subtitle}
          activeBuyerName={buyerName}
          activeBuyerNit={buyerNit}
          onOpenCompanyModal={() => setIsCompanyModalOpen(true)}
          onOpenUploader={() => setActiveTab('uploader')}
          isDark={isDark}
          onToggleTheme={toggleTheme}
          onOpenMobileNav={() => setIsMobileNavOpen(true)}
        />

        {/* Dynamic Page Content */}
        <main className="flex-1 p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-7xl w-full mx-auto animate-fade-in">
          {/* Top KPI Metrics (Always visible or in Dashboard) */}
          <DashboardStats history={history} activeBuyerName={buyerName} />

          {/* View: Dashboard or Uploader */}
          {(activeTab === 'dashboard' || activeTab === 'uploader') && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start">
              {/* Left Column: Upload Dropzone */}
              <div className="lg:col-span-5 space-y-4 sm:space-y-6">
                <InvoiceUploader
                  selectedFile={selectedFile}
                  previewUrl={previewUrl}
                  isProcessing={isProcessing}
                  optimizationStats={optimizationStats}
                  onFileSelect={handleFileSelect}
                  onClearFile={() => {
                    setSelectedFile(null);
                    setPreviewUrl('');
                    setOptimizationStats(null);
                  }}
                  onProcessInvoice={processInvoice}
                />
              </div>

              {/* Right Column: Processing Status & Extracted Voucher */}
              <div className="lg:col-span-7 space-y-6 relative">
                <ProcessingStatus
                  isProcessing={isProcessing}
                  buyerNit={buyerNit}
                  duplicateNotice={duplicateNotice}
                />

                {fields ? (
                  <div className="space-y-6 animate-fade-in">
                    <InvoiceDetailCard
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

                    <InvoiceProductTable productos={productos} />
                  </div>
                ) : (
                  !isProcessing && (
                    <div className="rounded-2xl border border-border/80 bg-card p-10 text-center shadow-xs">
                      <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
                        <Receipt className="w-7 h-7 opacity-80" />
                      </div>
                      <h3 className="text-base font-bold text-foreground mb-1">Sin Factura Procesada</h3>
                      <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                        Carga o arrastra una imagen de factura en el panel izquierdo para extraer automáticamente los datos contables y generar el paquete .ZIP para Siigo Nube.
                      </p>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {/* View: History Table */}
          {(activeTab === 'dashboard' || activeTab === 'history') && (
            <div className="pt-2">
              <HistoryTable
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
          )}
        </main>
      </div>

      {/* Company Selector Modal */}
      <CompanyModal
        isOpen={isCompanyModalOpen}
        onClose={() => setIsCompanyModalOpen(false)}
        savedCompanies={savedCompanies}
        activeBuyerNit={buyerNit}
        onSelectCompany={(comp) => {
          setBuyerNit(comp.nit);
          setBuyerName(comp.nombre);
          showToast(`Empresa activa: ${comp.nombre}`, 'success');
        }}
        onSaveNewCompany={handleSaveCompany}
        onDeleteCompany={handleDeleteCompany}
      />

      {/* Floating Toast Notification */}
      <ToastNotification toast={toast} />
    </div>
  );
}
