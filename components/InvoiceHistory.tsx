'use client';

import React from 'react';
import {
  FileCheck2,
  Trash2,
  RefreshCw,
  CheckSquare,
  Square,
  Package,
  Download
} from 'lucide-react';
import { SupabaseInvoice } from '@/types/invoice';
import { formatMonetaryDisplay } from '@/lib/siigo-xml';

interface InvoiceHistoryProps {
  history: SupabaseInvoice[];
  selectedInvoiceIds: string[];
  isDeleting: boolean;
  buyerNit: string;
  onSelectAll: () => void;
  onToggleSelect: (id: string) => void;
  onDeleteSelected: (ids?: string[]) => void;
  onRefreshHistory: () => void;
  onDownloadXml: (invoiceId: string, nit: string) => void;
}

export const InvoiceHistory: React.FC<InvoiceHistoryProps> = ({
  history,
  selectedInvoiceIds,
  isDeleting,
  buyerNit,
  onSelectAll,
  onToggleSelect,
  onDeleteSelected,
  onRefreshHistory,
  onDownloadXml,
}) => {
  return (
    <section className="bg-white border border-[#BDD8E9] rounded-2xl p-6 shadow-md">
      <div className="flex items-center justify-between border-b border-[#BDD8E9]/60 pb-3 mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <FileCheck2 className="w-5 h-5 text-[#0A4174]" />
          <div>
            <h3 className="font-extrabold text-[#001D39] text-base">Historial de Facturas Integradas</h3>
            <p className="text-xs text-[#49769F]">
              {buyerNit ? `Mostrando compras de la empresa con NIT ${buyerNit}` : 'Compras registradas en la base de datos'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedInvoiceIds.length > 0 && (
            <button
              onClick={() => onDeleteSelected()}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Eliminar Seleccionados ({selectedInvoiceIds.length})</span>
            </button>
          )}

          <button
            onClick={onRefreshHistory}
            className="bg-[#EAF2F8] hover:bg-[#BDD8E9] border border-[#BDD8E9] text-[#001D39] font-bold px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#0A4174]" />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#001D39] text-[#BDD8E9] uppercase font-bold text-[11px]">
              <th className="p-3 rounded-l-lg w-10 text-center">
                <button
                  onClick={onSelectAll}
                  title="Seleccionar todo"
                  className="focus:outline-none"
                >
                  {history.length > 0 && selectedInvoiceIds.length === history.length ? (
                    <CheckSquare className="w-4 h-4 text-[#7BBDE8]" />
                  ) : (
                    <Square className="w-4 h-4 text-[#BDD8E9]/60 hover:text-white" />
                  )}
                </button>
              </th>
              <th className="p-3">Fecha</th>
              <th className="p-3">N° Doc</th>
              <th className="p-3">Proveedor</th>
              <th className="p-3">Ítems</th>
              <th className="p-3">Subtotal</th>
              <th className="p-3">IVA</th>
              <th className="p-3">TOTAL</th>
              <th className="p-3 text-right rounded-r-lg">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#BDD8E9]/50">
            {history.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-6 text-center text-[#49769F]">
                  Aún no hay compras registradas para esta empresa.
                </td>
              </tr>
            ) : (
              history.map((item) => {
                const isSelected = selectedInvoiceIds.includes(item.id);
                const provNit = item.proveedor_nit || item.nit || 'N/A';
                return (
                  <tr
                    key={item.id}
                    className={`transition-colors ${
                      isSelected ? 'bg-[#EAF2F8]' : 'hover:bg-[#EAF2F8]/60'
                    }`}
                  >
                    <td className="p-3 text-center">
                      <button
                        onClick={() => onToggleSelect(item.id)}
                        className="focus:outline-none"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-[#0A4174]" />
                        ) : (
                          <Square className="w-4 h-4 text-[#49769F]/50 hover:text-[#0A4174]" />
                        )}
                      </button>
                    </td>
                    <td className="p-3 font-semibold text-[#001D39] whitespace-nowrap">{item.fecha || '-'}</td>
                    <td className="p-3 font-bold text-[#0A4174] whitespace-nowrap">
                      <span className="bg-[#EAF2F8] px-2 py-0.5 rounded text-[11px] font-mono">
                        {item.numero_factura || 'S/N'}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="font-extrabold text-[#001D39]">{item.proveedor_nombre || `PROVEEDOR ${provNit}`}</div>
                      <div className="text-[10px] text-[#49769F] font-semibold">NIT: {provNit}</div>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 bg-[#EAF2F8] text-[#0A4174] px-2 py-0.5 rounded-md font-bold text-[10px]">
                        <Package className="w-3 h-3 text-[#49769F]" />
                        {item.productos && item.productos.length > 0 ? `${item.productos.length} ítems` : '1 ítem'}
                      </span>
                    </td>
                    <td className="p-3 text-[#49769F] font-semibold">{formatMonetaryDisplay(item.subtotal)}</td>
                    <td className="p-3 text-[#49769F] font-semibold">{formatMonetaryDisplay(item.iva)}</td>
                    <td className="p-3 font-black text-[#001D39] text-sm">{formatMonetaryDisplay(item.total)}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onDownloadXml(item.id, provNit)}
                          className="bg-[#001D39] hover:bg-[#0A4174] text-white px-2.5 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-all shadow-sm"
                          title="Descargar XML"
                        >
                          <Download className="w-3 h-3 text-[#7BBDE8]" />
                          <span>XML</span>
                        </button>

                        <button
                          onClick={() => onDeleteSelected([item.id])}
                          className="bg-red-100 hover:bg-red-200 text-red-700 p-1.5 rounded-lg transition-all"
                          title="Eliminar factura"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};
