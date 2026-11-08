/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace', 'Courier New'],
      },
      colors: {
        nasa: {
          cyan: '#00F0FF',
          ochre: '#C85A32',
          ink: '#090d16',
          dark: '#05070B',
          amber: '#FFB800'
        }
      }
    },
  },
  plugins: [],
}

