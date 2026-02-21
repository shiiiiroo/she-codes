/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        ink: {
          DEFAULT: '#0f0f14',
          2: '#1e1e2a',
          3: '#2d2d3f',
          4: '#4a4a6a',
          5: '#8888aa',
        },
        accent: {
          DEFAULT: '#6c63ff',
          soft: 'rgba(108,99,255,0.12)',
        },
        surface: {
          DEFAULT: '#13131d',
          2: '#1a1a28',
          3: '#222233',
        },
      },
    },
  },
  plugins: [],
}
