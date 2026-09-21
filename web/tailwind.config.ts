import type { Config } from 'tailwindcss'

export default <Partial<Config>>{
  theme: {
    extend: {
      fontFamily: {
        sans: ['Prompt', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Minimal, elegant light-green brand scale (replaces default Tailwind green-*).
        brand: {
          50: '#f4f8f2',
          100: '#e6efe1',
          200: '#ccdfc3',
          300: '#a9c99a',
          400: '#82ac6e',
          500: '#62934c',
          600: '#4c7a3a',
          700: '#3d6230',
          800: '#324f28',
          900: '#2a4122',
        },
      },
      borderRadius: {
        xl: '0.85rem',
        '2xl': '1.1rem',
      },
    },
  },
}
