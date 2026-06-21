import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#0B1F3A',
        // Two-tone theme: Blue + Teal
        softblue: '#3B82F6', // primary
        teal: '#14B8A6', // secondary

        // surfaces
        bg: '#0B1220', // app chrome
        surface: '#FFFFFF',
        elevated: '#FFFFFF',
        muted: '#F6F7FB', // page background

        // borders
        border: '#E5E7EB',
        borderStrong: '#CBD5E1',

        // text
        ink: '#0F172A',
        sub: '#475569',
        faint: '#94A3B8',

        // dark shell text
        shell: '#0B1220',
        shellBorder: '#1F2A3D',
        shellText: '#E5E7EB',
        shellSub: '#A7B0C0',

        // accent / status
        accent: '#14B8A6', // teal as primary button
        accent2: '#3B82F6', // blue as secondary accent
        success: '#16A34A',
        warn: '#D97706',
        danger: '#DC2626',
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,0.06), 0 14px 34px rgba(15,23,42,0.10)',
        focus: '0 0 0 4px rgba(59,130,246,0.20)',
        soft: '0 1px 1px rgba(15,23,42,0.05), 0 8px 16px rgba(15,23,42,0.06)',
        chrome: '0 10px 30px rgba(2,6,23,0.35)',
      },
      borderRadius: {
        xl2: '1rem',
      },
    },
  },
  plugins: [],
} satisfies Config

