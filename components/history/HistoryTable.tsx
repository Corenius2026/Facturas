'use client';

import React, { useState, useMemo } from 'react';
import {
  History,
  Trash2,
  RefreshCw,
  CheckSquare,
  Square,
  Package,
  Download,
  Search,
  Building2,
  Calendar,
  FileCheck,
  AlertCircle,
  X,
} from 'lucide-react';
import { SupabaseInvoice } from '@/types/invoice';
import { formatMonetaryDisplay } from '@/lib/siigo-xml';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
    <Card className="shadow-sm border-border">
      <CardHeader className="p-5 pb-4 border-b border-border">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">Historial de Facturas de Compra</CardTitle>
                <Badge variant="secondary" className="text-[10px]">
                  {filteredHistory.length} registros
                </Badge>
              </div>
              <CardDescription>
                {buyerNit ? `Compras integradas para la empresa con NIT ${buyerNit}` : 'Compras registradas'}
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Buscar por proveedor, NIT o N°..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-8 h-9 text-xs"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Batch Delete */}
            {selectedInvoiceIds.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onDeleteSelected()}
                disabled={isDeleting}
                className="h-9 gap-1.5 font-bold animate-fade-in"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar ({selectedInvoiceIds.length})</span>
              </Button>
            )}

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={onRefreshHistory}
              className="h-9 gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5 text-primary" />
              <span>Actualizar</span>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground uppercase font-bold text-[10px] border-b border-border">
                <th className="p-3.5 w-10 text-center">
                  <button
                    onClick={onSelectAll}
                    title="Seleccionar todo"
                    className="focus:outline-none flex items-center justify-center mx-auto"
                  >
                    {filteredHistory.length > 0 && selectedInvoiceIds.length === filteredHistory.length ? (
                      <CheckSquare className="w-4 h-4 text-primary" />
                    ) : (
                      <Square className="w-4 h-4 text-muted-foreground/60 hover:text-foreground" />
                    )}
                  </button>
                </th>
                <th className="p-3.5">Fecha</th>
                <th className="p-3.5">N° Documento</th>
                <th className="p-3.5">Proveedor (Emisor)</th>
                <th className="p-3.5 text-center">Ítems</th>
                <th className="p-3.5">Subtotal</th>
                <th className="p-3.5">IVA</th>
                <th className="p-3.5">Total Liquidado</th>
                <th className="p-3.5 text-center">Estado</th>
                <th className="p-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-muted-foreground">
                    <History className="w-10 h-10 mx-auto mb-2 text-muted-foreground/40" />
                    <p className="text-sm font-bold text-foreground mb-0.5">
                      {searchTerm ? 'No se encontraron facturas con ese criterio' : 'Aún no hay compras registradas'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {searchTerm ? 'Intenta buscar con otro término o limpia el filtro.' : 'Carga una factura en el panel para integrarla automáticamente con Siigo.'}
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
                        isSelected ? 'bg-primary/5' : 'hover:bg-muted/30'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => onToggleSelect(item.id)}
                          className="focus:outline-none flex items-center justify-center mx-auto"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-primary" />
                          ) : (
                            <Square className="w-4 h-4 text-muted-foreground/60 hover:text-foreground" />
                          )}
                        </button>
                      </td>

                      {/* Fecha */}
                      <td className="p-3.5 font-semibold text-foreground whitespace-nowrap font-mono text-[11px]">
                        {item.fecha || '-'}
                      </td>

                      {/* N° Factura */}
                      <td className="p-3.5 whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-muted text-foreground font-mono font-bold text-[11px]">
                          {item.numero_factura || 'S/N'}
                        </span>
                      </td>

                      {/* Proveedor */}
                      <td className="p-3.5">
                        <div className="font-extrabold text-foreground truncate max-w-[200px]" title={item.proveedor_nombre || `PROVEEDOR ${provNit}`}>
                          {item.proveedor_nombre || `PROVEEDOR ${provNit}`}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono font-semibold">
                          NIT: {provNit}
                        </div>
                      </td>

                      {/* Ítems */}
                      <td className="p-3.5 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-0.5 rounded-md font-bold text-[10px]">
                          <Package className="w-3 h-3" />
                          {item.productos && item.productos.length > 0 ? `${item.productos.length}` : '1'}
                        </span>
                      </td>

                      {/* Subtotal */}
                      <td className="p-3.5 font-mono text-muted-foreground whitespace-nowrap">
                        {formatMonetaryDisplay(item.subtotal)}
                      </td>

                      {/* IVA */}
                      <td className="p-3.5 font-mono text-muted-foreground whitespace-nowrap">
                        {formatMonetaryDisplay(item.iva)}
                      </td>

                      {/* Total */}
                      <td className="p-3.5 font-mono font-black text-foreground text-xs whitespace-nowrap">
                        {formatMonetaryDisplay(item.total)}
                      </td>

                      {/* Estado Badge */}
                      <td className="p-3.5 text-center whitespace-nowrap">
                        <Badge variant={isRevision ? 'warning' : 'success'} className="text-[9px]">
                          {isRevision ? 'Revisión' : 'OK UBL 2.1'}
                        </Badge>
                      </td>

                      {/* Acciones */}
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="siigo"
                            size="sm"
                            onClick={() => onDownloadXml(item.id, provNit)}
                            className="h-8 gap-1 font-bold"
                            title="Descargar XML"
                          >
                            <Download className="w-3.5 h-3.5 text-sky-400" />
                            <span>XML</span>
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDeleteSelected([item.id])}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title="Eliminar factura"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};
