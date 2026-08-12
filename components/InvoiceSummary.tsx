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
  Tag
} from 'lucide-react';
import { FacturaDatos } from '@/types/invoice';
import { formatMonetaryDisplay } from '@/lib/siigo-xml';

interface InvoiceSummaryProps {
  fields: FacturaDatos;
  buyerName: string;
  buyerNit: string;
  zipFilename: string;
  onDownloadZip: () => void;
  onDownloadXml: () => void;
  onCopyXml: () => void;
  onDownloadCsv: () => void;
}

export const InvoiceSummary: React.FC<InvoiceSummaryProps> = ({
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
    <div className="space-y-6">
      {/* Export Buttons Bar for Siigo */}
      <div className="bg-gradient-to-r from-[#001D39] to-[#0A4174] border border-[#49769F]/40 rounded-2xl p-5 shadow-lg text-white space-y-3">
        <div className="flex items-center justify-between border-b border-white/10 pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <FileArchive className="w-6 h-6 text-[#7BBDE8]" />
            <div>
              <h3 className="font-bold text-sm">Archivos de Carga para Siigo Nube</h3>
              <p className="text-[11px] text-[#BDD8E9]">
                Empresa Receptora: <strong className="text-[#7BBDE8]">{buyerName || 'MI EMPRESA'} (NIT: {buyerNit || '901584216'})</strong>
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono bg-white/10 px-2.5 py-1 rounded-md text-[#BDD8E9]">
            {zipFilename || 'z08XXXXXXXX.zip'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
          {/* Botón 1: Descargar ZIP */}
          <button
            onClick={onDownloadZip}
            className="bg-[#7BBDE8] hover:bg-white text-[#001D39] font-extrabold px-3.5 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all group"
          >
            <Download className="w-4 h-4 text-[#001D39] group-hover:scale-110 transition-transform" />
            <span>Descargar .ZIP Siigo</span>
          </button>

          {/* Botón 2: Descargar XML */}
          <button
            onClick={onDownloadXml}
            className="bg-white/10 hover:bg-white/20 text-white font-bold px-3.5 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 border border-white/20 transition-all"
          >
            <Download className="w-4 h-4 text-[#7BBDE8]" />
            <span>Descargar XML UBL 2.1</span>
          </button>

          {/* Botón 3: Copiar XML */}
          <button
            onClick={onCopyXml}
            className="bg-white/10 hover:bg-white/20 text-white font-bold px-3.5 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 border border-white/20 transition-all"
          >
            <Copy className="w-4 h-4 text-[#BDD8E9]" />
            <span>Copiar XML</span>
          </button>

          {/* Botón 4: Plantilla CSV */}
          <button
            onClick={onDownloadCsv}
            className="bg-emerald-600/90 hover:bg-emerald-600 text-white font-bold px-3.5 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
            <span>Plantilla CSV Siigo</span>
          </button>
        </div>
      </div>

      {/* Structured Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
        {/* Proveedor */}
        <div className="bg-white border border-[#BDD8E9] p-4 rounded-xl shadow-sm">
          <div className="flex items-center gap-2 text-[#49769F] mb-1">
            <Building2 className="w-4 h-4 text-[#0A4174]" />
            <span className="text-[11px] font-bold uppercase">Proveedor</span>
          </div>
          <p className="text-sm font-extrabold text-[#001D39] truncate" title={fields.NombreProveedor || 'PROVEEDOR'}>
            {fields.NombreProveedor || 'PROVEEDOR'}
          </p>
          <span className="text-[11px] text-[#49769F] font-semibold">NIT: {fields.NIT}</span>
        </div>

        {/* Fecha */}
        <div className="bg-white border border-[#BDD8E9] p-4 rounded-xl shadow-sm">
          <div className="flex items-center gap-2 text-[#49769F] mb-1">
            <Calendar className="w-4 h-4 text-[#0A4174]" />
            <span className="text-[11px] font-bold uppercase">Fecha Emisión</span>
          </div>
          <p className="text-sm font-extrabold text-[#001D39]">{fields.Fecha}</p>
          <span className="text-[11px] text-[#49769F]">Formato DIAN</span>
        </div>

        {/* Subtotal */}
        <div className="bg-white border border-[#BDD8E9] p-4 rounded-xl shadow-sm">
          <div className="flex items-center gap-2 text-[#49769F] mb-1">
            <DollarSign className="w-4 h-4 text-[#0A4174]" />
            <span className="text-[11px] font-bold uppercase">Subtotal</span>
          </div>
          <p className="text-sm font-extrabold text-[#001D39]">{formatMonetaryDisplay(fields.Subtotal)}</p>
          <span className="text-[11px] text-[#49769F]">Antes de impuestos</span>
        </div>

        {/* IVA */}
        <div className="bg-white border border-[#BDD8E9] p-4 rounded-xl shadow-sm">
          <div className="flex items-center gap-2 text-[#49769F] mb-1">
            <Tag className="w-4 h-4 text-[#0A4174]" />
            <span className="text-[11px] font-bold uppercase">IVA (19%)</span>
          </div>
          <p className="text-sm font-extrabold text-[#001D39]">{formatMonetaryDisplay(fields.IVA)}</p>
          <span className="text-[11px] text-[#49769F]">Impuesto discriminado</span>
        </div>

        {/* Total Factura */}
        <div className="bg-gradient-to-br from-[#001D39] to-[#0A4174] border border-[#001D39] p-4 rounded-xl shadow-md text-white sm:col-span-2">
          <div className="flex items-center gap-2 text-[#7BBDE8] mb-1">
            <DollarSign className="w-4 h-4" />
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Factura</span>
          </div>
          <p className="text-xl font-black text-white">{formatMonetaryDisplay(fields.Total)}</p>
          <span className="text-[10px] text-[#BDD8E9]">Valor total liquidado</span>
        </div>
      </div>
    </div>
  );
};
