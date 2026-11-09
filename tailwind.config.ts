import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0C0E13',
        surface: {
          DEFAULT: '#14171F',
          elevated: '#1B1F2A',
        },
        border: {
          DEFAULT: '#232834',
          hover: '#3A4254',
        },
        foreground: '#E8EAF0',
        muted: '#9AA1B2',
        radar: {
          green: '#4ADE9A',
          greenDark: '#07110C',
          yellow: '#F5B544',
          red: '#FF7A7A',
        },
      },
      borderRadius: {
        card: '20px',
        btn: '12px',
      },
      fontFamily: {
        disp: ['var(--font-bricolage)', 'sans-serif'],
        sans: ['var(--font-inter)', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;

