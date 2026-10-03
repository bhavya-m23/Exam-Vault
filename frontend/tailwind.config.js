/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#070b14',
          900: '#0b1120',
          850: '#101828',
          800: '#1e293b',
          700: '#334155',
        },
        vault: {
          cyan: '#06b6d4',
          blue: '#3b82f6',
          emerald: '#10b981',
          danger: '#ef4444',
          amber: '#f59e0b',
          purple: '#8b5cf6',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'vault-glow': '0 0 30px -5px rgba(59, 130, 246, 0.25)',
        'red-glow': '0 0 30px -5px rgba(239, 68, 68, 0.25)',
        'green-glow': '0 0 30px -5px rgba(16, 185, 129, 0.25)',
      }
    },
  },
  plugins: [],
}
