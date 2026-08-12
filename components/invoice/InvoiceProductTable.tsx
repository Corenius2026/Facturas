'use client';

import React from 'react';
import { Package, Search } from 'lucide-react';
import { ProductoItem } from '@/types/invoice';
import { formatMonetaryDisplay } from '@/lib/siigo-xml';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface InvoiceProductTableProps {
  productos: ProductoItem[];
}

export const InvoiceProductTable: React.FC<InvoiceProductTableProps> = ({ productos }) => {
  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <CardTitle className="text-base">Productos y Servicios Extraídos</CardTitle>
            <CardDescription>Ítems individuales listos para la estructura UBL 2.1</CardDescription>
          </div>
        </div>
        <Badge variant="secondary" className="font-bold">
          {productos.length} {productos.length === 1 ? 'artículo' : 'artículos'}
        </Badge>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground uppercase font-bold text-[10px] border-b border-border">
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4 w-20 text-center">Cantidad</th>
                <th className="py-3 px-4">Descripción del Ítem</th>
                <th className="py-3 px-4 text-right">Precio Unitario</th>
                <th className="py-3 px-4 text-right">Total Ítem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {productos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 px-4 text-center text-muted-foreground">
                    <Package className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                    <p className="text-xs font-semibold">No se detectaron productos individuales</p>
                    <p className="text-[11px] text-muted-foreground/70">Se generará un ítem de mercancía general para Siigo Nube</p>
                  </td>
                </tr>
              ) : (
                productos.map((prod, index) => (
                  <tr key={index} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 text-center font-bold text-muted-foreground">{index + 1}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-md bg-primary/10 text-primary font-mono font-bold text-[11px]">
                        {prod.cantidad || '1'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-foreground">{prod.descripcion || 'PRODUCTO'}</td>
                    <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                      {formatMonetaryDisplay(prod.precio_unitario)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-foreground">
                      {formatMonetaryDisplay(prod.total_item)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};
