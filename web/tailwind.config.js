/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#8B4513',
        accent: '#D4A574',
        'primary-dark': '#6B3410',
        sepia: {
          bg: '#F5E6D0',
          card: '#EDD9B8',
          text: '#3B2A1A',
        },
      },
      fontFamily: {
        serif: ['Georgia', 'Cambria', 'serif'],
      },
    },
  },
  plugins: [],
}
