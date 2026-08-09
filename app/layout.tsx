import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Minimarket POS AI - Facturación a XML & Supabase',
  description: 'Digitalización inteligente de facturas de compra para minimarkets usando Google Gemini AI y Supabase en Vercel.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${jakarta.variable} ${mono.variable}`}>
      <body>
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="blob blob-1" />
          <div className="blob blob-2" />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </body>
    </html>
  );
}
