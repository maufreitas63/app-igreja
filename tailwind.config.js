/** @type {import('tailwindcss').Config} */
/**
 * Tokens de produto alinhados a `lib/minimalUiTheme.ts` (MINIMAL_UI / MINIMAL_TYPO).
 * Item 1 da migração NativeWind — só infraestrutura; telas StyleSheet não mudam.
 */
module.exports = {
  // Arquivos que usam className / utilitários Tailwind (NativeWind v4).
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './hooks/**/*.{js,jsx,ts,tsx}',
    './lib/**/*.{js,jsx,ts,tsx}',
    './context/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Kit shadcn / forms (components/ui) — mantido
        border: 'hsl(214.3 31.8% 91.4%)',
        input: 'hsl(214.3 31.8% 91.4%)',
        ring: 'hsl(222.2 84% 4.9%)',
        background: 'hsl(0 0% 100%)',
        foreground: 'hsl(222.2 84% 4.9%)',
        primary: {
          DEFAULT: 'hsl(222.2 47.4% 11.2%)',
          foreground: 'hsl(210 40% 98%)',
        },
        secondary: {
          DEFAULT: 'hsl(210 40% 96.1%)',
          foreground: 'hsl(222.2 47.4% 11.2%)',
        },
        destructive: {
          DEFAULT: 'hsl(0 84.2% 60.2%)',
          foreground: 'hsl(210 40% 98%)',
        },
        muted: {
          DEFAULT: 'hsl(210 40% 96.1%)',
          foreground: 'hsl(215.4 16.3% 46.9%)',
        },
        accent: {
          DEFAULT: 'hsl(210 40% 96.1%)',
          foreground: 'hsl(222.2 47.4% 11.2%)',
        },
        // Paleta do app (MINIMAL_UI)
        minimal: {
          bg: '#FFFFFF',
          text: '#1E40AF',
          muted: '#3B82F6',
          icon: '#00008B',
          blue: '#1E40AF',
          'blue-dark': '#00008B',
          border: '#BFDBFE',
          divider: '#E2E8F0',
          accent: '#1D4ED8',
          hover: '#F8FAFC',
          expanded: '#FFFFFF',
          'on-dark': '#FFFFFF',
        },
      },
      fontSize: {
        // MINIMAL_TYPO
        'minimal-church': ['12px', { lineHeight: '16px', fontWeight: '600' }],
        'minimal-greeting': ['16px', { lineHeight: '22px', fontWeight: '700' }],
        'minimal-title': ['18px', { lineHeight: '24px', fontWeight: '700' }],
        'minimal-section': ['23px', { lineHeight: '28px', fontWeight: '700' }],
        'minimal-inbox': ['15px', { lineHeight: '20px', fontWeight: '700' }],
        'minimal-preview': ['13px', { lineHeight: '18px' }],
        'minimal-menu': ['15px', { lineHeight: '20px', fontWeight: '500' }],
        'minimal-label': ['13px', { lineHeight: '18px', fontWeight: '700' }],
      },
      spacing: {
        // Alturas/reservas do chrome minimal (uso futuro em className)
        'minimal-exit-bar': '56px',
        'minimal-top-identity': '80px',
        'minimal-top-chrome': '96px',
        'minimal-top-chrome-base': '52px',
        'minimal-top-chrome-expanded': '56px',
      },
      borderRadius: {
        lg: '0.5rem',
        md: 'calc(0.5rem - 2px)',
        sm: 'calc(0.5rem - 4px)',
      },
    },
  },
  plugins: [],
};
