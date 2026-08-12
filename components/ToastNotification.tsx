'use client';

import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { ToastNotification as ToastType } from '@/types/invoice';

interface ToastProps {
  toast: ToastType | null;
}

export const ToastNotification: React.FC<ToastProps> = ({ toast }) => {
  if (!toast) return null;

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl border shadow-2xl backdrop-blur-md text-sm font-semibold transition-all ${
        toast.type === 'error'
          ? 'bg-[#001D39] border-red-500 text-red-200'
          : toast.type === 'warning'
          ? 'bg-[#001D39] border-amber-500 text-amber-200'
          : 'bg-[#001D39] border-[#4E8EA2] text-[#BDD8E9]'
      }`}
    >
      {toast.type === 'error' && <AlertTriangle className="w-5 h-5 text-red-400" />}
      {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400" />}
      {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-[#7BBDE8]" />}
      <span>{toast.message}</span>
    </div>
  );
};
