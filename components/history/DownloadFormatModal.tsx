'use client';

import React, { useState } from 'react';
import {
  FileCode,
  FileArchive,
  FileSpreadsheet,
  X,
  Download,
  Loader2,
} from 'lucide-react';
import { SupabaseInvoice, FacturaDatos } from '@/types/invoice';
import {
  generarEstructuraSiigo,
  downloadXmlBlob,
  downloadSiigoZipPackage,
  downloadSiigoCsvTemplate,
} from '@/lib/siigo-xml';
import { Button } from '@/components/ui/button';

interface DownloadFormatModalProps {
  invoice: SupabaseInvoice | null;
  buyerNit: string;
  onClose: () => void;
}

export const DownloadFormatModal: React.FC<DownloadFormatModalProps> = ({
  invoice,
  buyerNit,
  onClose,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  if (!invoice) return null;

  const provNit = invoice.proveedor_nit || invoice.nit || 'N/A';
  const provName = invoice.proveedor_nombre || `PROVEEDOR ${provNit}`;
  const docNum = invoice.numero_factura || 'Factura';

  const getInvoiceData = async () => {
    // Intentar recuperar el XML original almacenado en base de datos si existe
    let xmlContent = '';
    try {
      const res = await fetch(`/api/facturas?id=${encodeURIComponent(invoice.id)}`);
      const data = await res.json();
      if (data.success && data.factura?.xml_content) {
        xmlContent = data.factura.xml_content;
      }
    } catch (e) {
      console.warn('No se pudo recuperar XML de BD, generando nuevo:', e);
    }

    const fields: FacturaDatos = {
      NIT: provNit,
      NombreProveedor: invoice.proveedor_nombre || '',
      BuyerNIT: invoice.buyer_nit || buyerNit || '901584216',
      BuyerName: invoice.buyer_name || 'MI EMPRESA SAS',
      Fecha: invoice.fecha || '',
      Subtotal: String(invoice.subtotal || '0'),
      IVA: String(invoice.iva || '0'),
      Total: String(invoice.total || '0'),
      Productos: Array.isArray(invoice.productos) ? invoice.productos : [],
    };

    const est = await generarEstructuraSiigo(fields, invoice.numero_factura);
    return {
      fields,
      xmlContent: xmlContent || est.attachedXml,
      est,
    };
  };

  const handleDownloadXml = async () => {
    setIsProcessing(true);
    try {
      const { xmlContent } = await getInvoiceData();
      const filename = `factura_${provNit}_${invoice.numero_factura || invoice.id.substring(0, 8)}.xml`;
      downloadXmlBlob(xmlContent, filename);
      onClose();
    } catch (err) {
      console.error('Error al descargar XML:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadZip = async () => {
    setIsProcessing(true);
    try {
      const { fields, xmlContent, est } = await getInvoiceData();
      await downloadSiigoZipPackage(
        fields,
        xmlContent,
        est.zipFilename,
        est.xmlFilenameInside,
        est.pdfFilenameInside
      );
      onClose();
    } catch (err) {
      console.error('Error al descargar ZIP:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadCsv = async () => {
    setIsProcessing(true);
    try {
      const { fields } = await getInvoiceData();
      downloadSiigoCsvTemplate(fields, fields.Productos);
      onClose();
    } catch (err) {
      console.error('Error al descargar CSV:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-fade-in">
      <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h3 className="text-lg font-bold tracking-tight text-foreground">
              Formato de Descarga
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {provName} • {docNum}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Format Options */}
        <div className="p-6 space-y-3">
          {/* XML Option */}
          <button
            onClick={handleDownloadXml}
            disabled={isProcessing}
            className="w-full flex items-center gap-4 p-4 rounded-xl border border-border hover:border-[#E09145] hover:bg-muted/40 transition-colors text-left group"
          >
            <div className="w-11 h-11 rounded-xl bg-[#292C35] text-[#E09145] flex items-center justify-center shrink-0">
              <FileCode className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-foreground group-hover:text-[#E09145] transition-colors">
                Archivo XML
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Factura electrónica original en formato estándar XML
              </p>
            </div>
            <Download className="w-4 h-4 text-muted-foreground group-hover:text-[#E09145] transition-colors shrink-0" />
          </button>

          {/* CSV Option */}
          <button
            onClick={handleDownloadCsv}
            disabled={isProcessing}
            className="w-full flex items-center gap-4 p-4 rounded-xl border border-border hover:border-[#E09145] hover:bg-muted/40 transition-colors text-left group"
          >
            <div className="w-11 h-11 rounded-xl bg-[#292C35] text-[#E09145] flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-foreground group-hover:text-[#E09145] transition-colors">
                Plantilla Excel / CSV
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Planilla con discriminación de ítems, precios e impuestos
              </p>
            </div>
            <Download className="w-4 h-4 text-muted-foreground group-hover:text-[#E09145] transition-colors shrink-0" />
          </button>
        </div>

        {/* Footer */}
        {isProcessing && (
          <div className="px-6 py-3 bg-muted/40 border-t border-border flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span>Generando archivo...</span>
          </div>
        )}
      </div>
    </div>
  );
};
