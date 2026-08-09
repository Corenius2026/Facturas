/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#EAF2F8',      // Fondo casi blanco / hielo elegante
          card: '#FFFFFF',    // Tarjetas blancas limpias
          navy: '#001D39',    // Azul marino oscuro para textos y cabeceras
          primary: '#0A4174', // Azul primario para botones y acentos
          slate: '#49769F',   // Gris azulado para bordes e iconos
          steel: '#4E8EA2',   // Azul acero secundario
          cyan: '#6EA2B3',    // Ciano suave
          sky: '#7BBDE8',     // Azul cielo para detalles y badges
          ice: '#BDD8E9',     // Azul hielo claro
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}
