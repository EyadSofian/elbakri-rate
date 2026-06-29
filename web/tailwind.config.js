/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#07184A',
          50: '#eef1f8',
          100: '#d6deef',
          200: '#aebfdd',
          300: '#7e96c6',
          400: '#506fae',
          500: '#33508f',
          600: '#243d72',
          700: '#1a2f5c',
          800: '#102049',
          900: '#07184A',
          950: '#040d2b',
        },
        gold: {
          DEFAULT: '#C8A24A',
          light: '#E3C77E',
          dark: '#A8862F',
        },
        surface: {
          DEFAULT: '#F4F6FB',
          muted: '#E9EEF6',
          card: '#FFFFFF',
        },
        ink: {
          DEFAULT: '#0E1A33',
          muted: '#5A6B86',
        },
      },
      fontFamily: {
        sans: ['Cairo', 'Tajawal', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '8px',
        btn: '8px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(7,24,74,0.06), 0 1px 3px rgba(7,24,74,0.04)',
        soft: '0 4px 16px rgba(7,24,74,0.08)',
        pop: '0 8px 30px rgba(7,24,74,0.16)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: {
        'fade-in': 'fade-in 0.15s ease-out',
        'slide-up': 'slide-up 0.2s ease-out',
      },
    },
  },
  plugins: [],
}
