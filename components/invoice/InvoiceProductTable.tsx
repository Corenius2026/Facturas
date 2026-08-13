'use client';

import React from 'react';
import { Package } from 'lucide-react';
import { ProductoItem } from '@/types/invoice';
import { formatMonetaryDisplay } from '@/lib/siigo-xml';

interface InvoiceProductTableProps {
  productos: ProductoItem[];
}

export const InvoiceProductTable: React.FC<InvoiceProductTableProps> = ({ productos }) => {
  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden">
      <div className="p-6 border-b border-border flex items-center justify-between">
        <h3 className="text-xl font-bold tracking-tight text-foreground">Productos y Servicios Extraídos</h3>
        <span className="text-xs font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-md">
          {productos.length} {productos.length === 1 ? 'artículo' : 'artículos'}
        </span>
      </div>

      <div className="overflow-x-auto max-h-[224px] overflow-y-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="sticky top-0 bg-card z-10 border-b border-border">
            <tr className="text-muted-foreground">
              <th className="py-3 px-6 font-semibold text-center w-16 bg-card">#</th>
              <th className="py-3 px-6 font-semibold text-center w-24 bg-card">Cantidad</th>
              <th className="py-3 px-6 font-semibold bg-card">Descripción del Ítem</th>
              <th className="py-3 px-6 font-semibold text-right bg-card">Precio Unitario</th>
              <th className="py-3 px-6 font-semibold text-right bg-card">Total Ítem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {productos.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 px-6 text-center text-muted-foreground">
                  <Package className="w-8 h-8 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-sm font-semibold">No se detectaron productos individuales</p>
                  <p className="text-xs mt-1">Se generará un ítem de mercancía general</p>
                </td>
              </tr>
            ) : (
              productos.map((prod, index) => (
                <tr key={index} className="hover:bg-muted/20 transition-colors">
                  <td className="py-3 px-6 text-center text-muted-foreground">{index + 1}</td>
                  <td className="py-3 px-6 text-center font-mono text-muted-foreground">
                    {prod.cantidad || '1'}
                  </td>
                  <td className="py-3 px-6 font-medium text-foreground">{prod.descripcion || 'PRODUCTO'}</td>
                  <td className="py-3 px-6 text-right font-mono text-muted-foreground">
                    {formatMonetaryDisplay(prod.precio_unitario)}
                  </td>
                  <td className="py-3 px-6 text-right font-mono font-bold text-foreground">
                    {formatMonetaryDisplay(prod.total_item)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

