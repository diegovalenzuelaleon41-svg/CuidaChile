/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // CuidaChile Fase 1 — spec §1
        brand: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          900: '#1E3A8A',
        },
        ink: '#1E293B',
        heading: '#0F172A',
        muted: '#64748B',
        faint: '#94A3B8',
        line: '#E2E8F0',
        canvas: '#F8FAFC',
        sos: '#DC2626',
        ok: '#10B981',
        warn: '#F59E0B',
      },
      borderRadius: {
        card: '16px',
        btn: '10px',
      },
      boxShadow: {
        soft: '0 4px 20px rgba(0,0,0,0.06)',
        lift: '0 20px 60px rgba(0,0,0,0.08)',
        brand: '0 8px 24px rgba(37,99,235,0.25)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
