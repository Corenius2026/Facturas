'use client';

import React from 'react';
import { Package, ListOrdered } from 'lucide-react';
import { ProductoItem } from '@/types/invoice';
import { formatMonetaryDisplay } from '@/lib/siigo-xml';

interface ProductTableProps {
  productos: ProductoItem[];
}

export const ProductTable: React.FC<ProductTableProps> = ({ productos }) => {
  return (
    <div className="bg-white border border-[#BDD8E9] rounded-2xl p-5 shadow-md">
      <div className="flex items-center justify-between border-b border-[#BDD8E9]/60 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-[#0A4174]" />
          <h3 className="font-bold text-sm text-[#001D39]">Productos / Ítems Detectados</h3>
        </div>
        <span className="text-xs bg-[#EAF2F8] text-[#0A4174] font-bold px-2.5 py-1 rounded-lg">
          {productos.length} {productos.length === 1 ? 'artículo' : 'artículos'}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#EAF2F8] text-[#001D39] uppercase font-bold text-[10px]">
              <th className="p-2.5 rounded-l-lg w-12 text-center">#</th>
              <th className="p-2.5 w-16 text-center">Cant.</th>
              <th className="p-2.5">Descripción</th>
              <th className="p-2.5 text-right">P. Unitario</th>
              <th className="p-2.5 text-right rounded-r-lg">Total Ítem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#BDD8E9]/40">
            {productos.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-4 text-center text-[#49769F]">
                  No se desglosaron productos individuales (se usará ítem general para Siigo).
                </td>
              </tr>
            ) : (
              productos.map((prod, index) => (
                <tr key={index} className="hover:bg-[#EAF2F8]/50 transition-colors">
                  <td className="p-2.5 text-center font-bold text-[#49769F]">{index + 1}</td>
                  <td className="p-2.5 text-center font-bold text-[#0A4174]">{prod.cantidad || '1'}</td>
                  <td className="p-2.5 font-semibold text-[#001D39]">{prod.descripcion || 'PRODUCTO'}</td>
                  <td className="p-2.5 text-right text-[#49769F]">{formatMonetaryDisplay(prod.precio_unitario)}</td>
                  <td className="p-2.5 text-right font-bold text-[#001D39]">{formatMonetaryDisplay(prod.total_item)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
