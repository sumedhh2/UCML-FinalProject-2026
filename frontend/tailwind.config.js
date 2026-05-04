/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#030213',
          foreground: '#ffffff',
        },
        secondary: {
          DEFAULT: '#f8f9fa',
          foreground: '#030213',
        },
        muted: {
          DEFAULT: '#ececf0',
          foreground: '#717182',
        },
        accent: {
          DEFAULT: '#e9ebef',
          foreground: '#030213',
        },
        background: '#ffffff',
        foreground: '#171717',
      },
      borderRadius: {
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
