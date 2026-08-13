'use client';

import React from 'react';
import {
  FileArchive,
  Download,
  Copy,
  FileSpreadsheet,
  Building2,
  Calendar,
  Receipt,
  FileCode,
} from 'lucide-react';
import { FacturaDatos } from '@/types/invoice';
import { formatMonetaryDisplay } from '@/lib/siigo-xml';
import { Button } from '@/components/ui/button';

interface InvoiceDetailCardProps {
  fields: FacturaDatos;
  buyerName: string;
  buyerNit: string;
  zipFilename: string;
  onDownloadZip: () => void;
  onDownloadXml: () => void;
  onCopyXml: () => void;
  onDownloadCsv: () => void;
}

export const InvoiceDetailCard: React.FC<InvoiceDetailCardProps> = ({
  fields,
  buyerName,
  buyerNit,
  zipFilename,
  onDownloadZip,
  onDownloadXml,
  onCopyXml,
  onDownloadCsv,
}) => {
  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden">
      {/* Header & Actions */}
      <div className="p-6 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-6 bg-card">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-foreground mb-1 flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#292C35] text-[#E09145]">
              <Receipt className="w-5 h-5" />
            </span>
            Resultados de Factura
          </h3>
          <p className="text-xs text-muted-foreground pl-8 font-mono">
            {zipFilename || 'Factura procesada'}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            onClick={onDownloadXml}
            className="gap-2 font-bold bg-[#E09145] text-[#17181D] hover:bg-[#E09145]/90 border-0"
          >
            <FileCode className="w-4 h-4 text-[#17181D]" />
            <span>Descargar XML</span>
          </Button>

          <Button
            onClick={onDownloadCsv}
            variant="outline"
            className="gap-2 font-semibold text-muted-foreground hover:text-foreground"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Plantilla CSV</span>
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-8 gap-x-12">
          {/* Detalles Generales */}
          <div className="space-y-6">
            <h4 className="text-xs font-bold text-[#E09145] uppercase tracking-wider">
              Detalles Generales
            </h4>
            
            <div className="grid grid-cols-2 gap-6">
              <div>
                <span className="block text-xs text-muted-foreground mb-1">Emisor (Proveedor)</span>
                <span className="block text-sm font-semibold text-foreground truncate">{fields.NombreProveedor || 'PROVEEDOR'}</span>
                <span className="block text-xs text-muted-foreground font-mono mt-0.5">NIT: {fields.NIT}</span>
              </div>
              <div>
                <span className="block text-xs text-muted-foreground mb-1">Receptor (Empresa)</span>
                <span className="block text-sm font-semibold text-foreground truncate">{buyerName}</span>
                <span className="block text-xs text-muted-foreground font-mono mt-0.5">NIT: {buyerNit}</span>
              </div>
              <div>
                <span className="block text-xs text-muted-foreground mb-1">Fecha de Factura</span>
                <span className="block text-sm font-semibold text-foreground">{fields.Fecha}</span>
              </div>
              <div>
                <span className="block text-xs text-muted-foreground mb-1">Nº Documento</span>
                <span className="block text-sm font-semibold text-foreground">{fields.NumeroFactura || 'Electrónica'}</span>
              </div>
            </div>
          </div>

          {/* Liquidación Contable */}
          <div className="space-y-6 md:pl-12 md:border-l md:border-border">
            <h4 className="text-xs font-bold text-[#E09145] uppercase tracking-wider">
              Liquidación Contable
            </h4>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Subtotal</span>
                <span className="text-base font-semibold text-foreground font-mono">{formatMonetaryDisplay(fields.Subtotal)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">IVA Discriminado</span>
                <span className="text-base font-semibold text-foreground font-mono">{formatMonetaryDisplay(fields.IVA)}</span>
              </div>
              <div className="h-px bg-border my-2"></div>
              <div className="flex justify-between items-center p-4 rounded-xl bg-card border border-border">
                <span className="text-sm font-bold text-foreground">Total Factura</span>
                <span className="text-2xl font-black tracking-tight text-[#E09145] font-mono">
                  {formatMonetaryDisplay(fields.Total)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


