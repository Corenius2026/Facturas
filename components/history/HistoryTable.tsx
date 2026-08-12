'use client';

import React, { useState, useMemo } from 'react';
import {
  History,
  Trash2,
  RefreshCw,
  CheckSquare,
  Square,
  Download,
  Search,
  X,
} from 'lucide-react';
import { SupabaseInvoice } from '@/types/invoice';
import { formatMonetaryDisplay } from '@/lib/siigo-xml';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface HistoryTableProps {
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

export const HistoryTable: React.FC<HistoryTableProps> = ({
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
  const [searchTerm, setSearchTerm] = useState('');

  // Filtrado reactivo en memoria por NIT, Razón Social o Número de Factura
  const filteredHistory = useMemo(() => {
    if (!searchTerm.trim()) return history;
    const term = searchTerm.toLowerCase().trim();
    return history.filter((item) => {
      const provNit = (item.proveedor_nit || item.nit || '').toLowerCase();
      const provName = (item.proveedor_nombre || '').toLowerCase();
      const docNum = (item.numero_factura || '').toLowerCase();
      const date = (item.fecha || '').toLowerCase();
      return (
        provNit.includes(term) ||
        provName.includes(term) ||
        docNum.includes(term) ||
        date.includes(term)
      );
    });
  }, [history, searchTerm]);

  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden">
      <div className="p-6 border-b border-border">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-xl font-bold tracking-tight text-foreground">Historial de Compras</h3>
              <span className="text-xs font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-md">
                {filteredHistory.length} registros
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {buyerNit ? `Integradas para la empresa NIT ${buyerNit}` : 'Compras registradas'}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Buscar proveedor o número..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-8 h-10 bg-muted/30 border-transparent focus-visible:border-primary/30 focus-visible:bg-background"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Batch Delete */}
            {selectedInvoiceIds.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDeleteSelected()}
                disabled={isDeleting}
                className="h-10 gap-2 text-destructive hover:text-destructive hover:bg-destructive/5 font-medium animate-fade-in"
              >
                <Trash2 className="w-4 h-4" />
                <span>Eliminar ({selectedInvoiceIds.length})</span>
              </Button>
            )}

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={onRefreshHistory}
              className="h-10 w-10 text-muted-foreground hover:text-foreground"
              title="Actualizar"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="py-4 px-6 font-medium text-center w-12">
                <button
                  onClick={onSelectAll}
                  title="Seleccionar todo"
                  className="focus:outline-none flex items-center justify-center mx-auto"
                >
                  {filteredHistory.length > 0 && selectedInvoiceIds.length === filteredHistory.length ? (
                    <CheckSquare className="w-4 h-4 text-foreground" />
                  ) : (
                    <Square className="w-4 h-4 text-muted-foreground/60 hover:text-foreground" />
                  )}
                </button>
              </th>
              <th className="py-4 px-6 font-medium">Fecha</th>
              <th className="py-4 px-6 font-medium">Documento</th>
              <th className="py-4 px-6 font-medium">Proveedor</th>
              <th className="py-4 px-6 font-medium text-center">Ítems</th>
              <th className="py-4 px-6 font-medium text-right">Total Liquidado</th>
              <th className="py-4 px-6 font-medium text-center">Estado</th>
              <th className="py-4 px-6 font-medium text-right w-24">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {filteredHistory.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-16 px-6 text-center text-muted-foreground">
                  <History className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-sm font-semibold text-foreground mb-1">
                    {searchTerm ? 'No se encontraron resultados' : 'Aún no hay compras registradas'}
                  </p>
                  <p className="text-xs">
                    {searchTerm ? 'Intenta buscar con otro término.' : 'Carga una factura en el panel superior.'}
                  </p>
                </td>
              </tr>
            ) : (
              filteredHistory.map((item) => {
                const isSelected = selectedInvoiceIds.includes(item.id);
                const provNit = item.proveedor_nit || item.nit || 'N/A';
                const isRevision = item.estado === 'requiere_revision';

                return (
                  <tr
                    key={item.id}
                    className={`transition-colors ${
                      isSelected ? 'bg-muted/50' : 'hover:bg-muted/20'
                    }`}
                  >
                    <td className="py-4 px-6 text-center">
                      <button
                        onClick={() => onToggleSelect(item.id)}
                        className="focus:outline-none flex items-center justify-center mx-auto"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-foreground" />
                        ) : (
                          <Square className="w-4 h-4 text-muted-foreground/60 hover:text-foreground" />
                        )}
                      </button>
                    </td>

                    <td className="py-4 px-6 font-mono text-muted-foreground whitespace-nowrap">
                      {item.fecha || '-'}
                    </td>

                    <td className="py-4 px-6 whitespace-nowrap">
                      <span className="font-mono text-foreground font-medium">
                        {item.numero_factura || 'S/N'}
                      </span>
                    </td>

                    <td className="py-4 px-6">
                      <div className="font-medium text-foreground truncate max-w-[200px]" title={item.proveedor_nombre || `PROVEEDOR ${provNit}`}>
                        {item.proveedor_nombre || `PROVEEDOR ${provNit}`}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">
                        NIT: {provNit}
                      </div>
                    </td>

                    <td className="py-4 px-6 text-center whitespace-nowrap text-muted-foreground">
                      {item.productos && item.productos.length > 0 ? item.productos.length : '1'}
                    </td>

                    <td className="py-4 px-6 font-mono font-medium text-foreground text-right whitespace-nowrap">
                      {formatMonetaryDisplay(item.total)}
                    </td>

                    <td className="py-4 px-6 text-center whitespace-nowrap">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${isRevision ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>
                        {isRevision ? 'Revisión' : 'OK UBL'}
                      </span>
                    </td>

                    <td className="py-4 px-6 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onDownloadXml(item.id, provNit)}
                          className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                          title="Descargar XML"
                        >
                          <Download className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => onDeleteSelected([item.id])}
                          className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                          title="Eliminar factura"
                        >
                          <Trash2 className="w-4 h-4" />
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
    </div>
  );
};

