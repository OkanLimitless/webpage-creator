/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#3b82f6', // blue-500
          dark: '#2563eb', // blue-600
          light: '#60a5fa', // blue-400
        },
        secondary: {
          DEFAULT: '#8b5cf6', // violet-500
          dark: '#7c3aed', // violet-600
          light: '#a78bfa', // violet-400
        },
        dark: {
          DEFAULT: '#111827', // gray-900
          lighter: '#1f2937', // gray-800
          light: '#374151', // gray-700
          card: '#1e1e2d',
          accent: '#2d2d3f',
        },
      },
      boxShadow: {
        'dark-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.5)',
        'dark-md': '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.4)',
        'dark-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.2)',
      },
    },
  },
  plugins: [],
} 