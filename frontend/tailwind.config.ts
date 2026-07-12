import type { Config } from 'tailwindcss';
import { fontFamily } from 'tailwindcss/defaultTheme';
import typography from '@tailwindcss/typography';
import forms from '@tailwindcss/forms';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter var', 'Inter', ...fontFamily.sans],
        mono: ['JetBrains Mono', 'Fira Code', ...fontFamily.mono],
      },
      colors: {
        // Studio dark theme palette
        studio: {
          bg: '#0e0e10',
          surface: '#18181b',
          panel: '#1c1c1f',
          border: '#2a2a2e',
          muted: '#3a3a40',
          text: '#e4e4e7',
          'text-muted': '#71717a',
          accent: '#7c3aed',
          'accent-hover': '#6d28d9',
          'accent-light': '#8b5cf6',
          success: '#22c55e',
          warning: '#f59e0b',
          error: '#ef4444',
          info: '#3b82f6',
        },
      },
      spacing: {
        '4.5': '1.125rem',
        '13': '3.25rem',
        '15': '3.75rem',
        '18': '4.5rem',
        '22': '5.5rem',
        '26': '6.5rem',
        '30': '7.5rem',
      },
      borderRadius: {
        '2xs': '0.125rem',
        xs: '0.1875rem',
      },
      boxShadow: {
        'panel': '0 0 0 1px rgba(255,255,255,0.06), 0 4px 16px rgba(0,0,0,0.4)',
        'tooltip': '0 4px 12px rgba(0,0,0,0.5)',
        'dropdown': '0 8px 24px rgba(0,0,0,0.6)',
        'modal': '0 16px 48px rgba(0,0,0,0.7)',
      },
      animation: {
        'fade-in': 'fadeIn 0.15s ease-out',
        'fade-out': 'fadeOut 0.1s ease-in',
        'slide-up': 'slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down': 'slideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scaleIn 0.15s ease-out',
        'spin-slow': 'spin 2s linear infinite',
        'pulse-subtle': 'pulseSubtle 2s ease-in-out infinite',
        'shimmer': 'shimmer 1.5s infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        fadeOut: {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          from: { opacity: '0', transform: 'translateY(-6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [typography, forms],
};

export default config;
