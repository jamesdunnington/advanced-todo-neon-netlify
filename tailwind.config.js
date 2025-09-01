/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,tsx,jsx,html}'
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          pink: '#ff3ea5',
          pink600: '#e23394',
          black: '#111111',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
    },
  },
  plugins: [],
};

