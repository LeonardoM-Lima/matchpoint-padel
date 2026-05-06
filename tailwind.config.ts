import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
        court: {
          deep: '#06241f',
          dark: '#0a3a31',
          medium: '#0f5a4a',
        },
        gold: {
          light: '#fde68a',
          DEFAULT: '#f59e0b',
          dark: '#b45309',
        },
      },
      backgroundImage: {
        'gradient-court':
          'radial-gradient(circle at 0% 0%, rgba(16,185,129,0.18) 0%, transparent 45%), radial-gradient(circle at 100% 0%, rgba(56,189,248,0.12) 0%, transparent 50%), radial-gradient(circle at 50% 100%, rgba(217,70,239,0.10) 0%, transparent 55%), linear-gradient(180deg, #020617 0%, #021c14 100%)',
        'gradient-emerald': 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        'gradient-gold': 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #b45309 100%)',
        'gradient-silver': 'linear-gradient(135deg, #f1f5f9 0%, #94a3b8 50%, #475569 100%)',
        'gradient-bronze': 'linear-gradient(135deg, #fdba74 0%, #c2410c 50%, #7c2d12 100%)',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(110,231,183,0.35), 0 10px 30px -10px rgba(16,185,129,0.5)',
        gold: '0 0 0 1px rgba(251,191,36,0.45), 0 12px 28px -10px rgba(251,191,36,0.55)',
        soft: '0 12px 40px -12px rgba(0,0,0,0.6)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-glow': 'pulseGlow 2.4s ease-in-out infinite',
        shimmer: 'shimmer 1.6s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(110,231,183,0.4)' },
          '50%': { boxShadow: '0 0 0 8px rgba(110,231,183,0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
