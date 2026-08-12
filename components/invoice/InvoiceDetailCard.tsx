'use client';

import React from 'react';
import {
  FileArchive,
  Download,
  Copy,
  FileSpreadsheet,
  Building2,
  Calendar,
  DollarSign,
  Tag,
  Receipt,
  FileCode,
  CheckCircle2,
} from 'lucide-react';
import { FacturaDatos } from '@/types/invoice';
import { formatMonetaryDisplay } from '@/lib/siigo-xml';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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
    <Card className="shadow-sm border-border overflow-hidden">
      {/* Siigo Action Bar */}
      <div className="bg-gradient-to-r from-primary via-primary/95 to-sky-700 text-primary-foreground p-5 border-b border-border">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/10 text-white backdrop-blur-md shadow-inner">
              <FileArchive className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-white tracking-tight">Archivos de Carga para Siigo Nube</h3>
                <Badge variant="outline" className="bg-white/10 text-white border-white/20 text-[9px]">
                  UBL 2.1
                </Badge>
              </div>
              <p className="text-xs text-primary-foreground/80 font-medium">
                Empresa Receptora: <strong className="text-white">{buyerName || 'MI EMPRESA'} (NIT: {buyerNit || '901584216'})</strong>
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono bg-white/15 px-3 py-1 rounded-lg text-white font-bold tracking-wide">
            {zipFilename || 'z08XXXXXXXX.zip'}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <Button
            onClick={onDownloadZip}
            className="bg-white text-primary hover:bg-white/90 font-black gap-2 shadow-md hover:scale-[1.02] transition-all"
            size="default"
          >
            <Download className="w-4 h-4 text-primary" />
            <span>Descargar .ZIP Siigo</span>
          </Button>

          <Button
            onClick={onDownloadXml}
            variant="outline"
            className="bg-white/10 hover:bg-white/20 text-white border-white/20 font-bold gap-2"
          >
            <FileCode className="w-4 h-4 text-white" />
            <span>Descargar XML</span>
          </Button>

          <Button
            onClick={onCopyXml}
            variant="outline"
            className="bg-white/10 hover:bg-white/20 text-white border-white/20 font-bold gap-2"
          >
            <Copy className="w-4 h-4 text-white" />
            <span>Copiar XML</span>
          </Button>

          <Button
            onClick={onDownloadCsv}
            variant="success"
            className="font-bold gap-2"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Plantilla CSV Siigo</span>
          </Button>
        </div>
      </div>

      {/* Accounting Card Content */}
      <CardContent className="p-6 space-y-6">
        {/* Top Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Proveedor */}
          <div className="p-4 rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
              <Building2 className="w-4 h-4 text-primary" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider">Proveedor (Emisor)</span>
            </div>
            <div className="text-sm font-extrabold text-foreground truncate" title={fields.NombreProveedor || 'PROVEEDOR'}>
              {fields.NombreProveedor || 'PROVEEDOR'}
            </div>
            <div className="text-xs font-mono text-muted-foreground font-semibold mt-0.5">
              NIT: {fields.NIT}
            </div>
          </div>

          {/* Comprador / Adquirente */}
          <div className="p-4 rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
              <Receipt className="w-4 h-4 text-primary" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider">Empresa en Siigo (Receptor)</span>
            </div>
            <div className="text-sm font-extrabold text-foreground truncate" title={buyerName}>
              {buyerName}
            </div>
            <div className="text-xs font-mono text-muted-foreground font-semibold mt-0.5">
              NIT: {buyerNit}
            </div>
          </div>

          {/* Documento y Fecha */}
          <div className="p-4 rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
              <Calendar className="w-4 h-4 text-primary" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider">Fecha y Documento</span>
            </div>
            <div className="text-sm font-extrabold text-foreground">
              {fields.Fecha}
            </div>
            <div className="text-xs text-muted-foreground font-semibold mt-0.5">
              {fields.NumeroFactura ? `Doc: ${fields.NumeroFactura}` : 'Factura Electrónica'}
            </div>
          </div>
        </div>

        {/* Financial Breakdown */}
        <div className="p-4 rounded-2xl border border-border bg-muted/30">
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
            Liquidación Contable
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
            <div className="p-3 rounded-xl bg-card border border-border">
              <span className="block text-[11px] font-semibold text-muted-foreground">Subtotal</span>
              <span className="text-base font-bold text-foreground">
                {formatMonetaryDisplay(fields.Subtotal)}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-card border border-border">
              <span className="block text-[11px] font-semibold text-muted-foreground">IVA Discriminado</span>
              <span className="text-base font-bold text-foreground">
                {formatMonetaryDisplay(fields.IVA)}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
              <span className="block text-[10px] font-extrabold text-primary-foreground/80 uppercase tracking-wider">
                Total Factura
              </span>
              <span className="text-xl font-black text-primary-foreground tracking-tight">
                {formatMonetaryDisplay(fields.Total)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
