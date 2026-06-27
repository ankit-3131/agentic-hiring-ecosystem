/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
    "!./node_modules/**",
    "!./dist/**",
  ],
  theme: {
    extend: {
      colors: {
        background: '#1A1A1A',
        foreground: '#E5E5E5',
        card: '#242424',
        cardHover: '#2A2A2A',
        primary: '#4ADE80',    // Green accent
        secondary: '#A78BFA',  // Purple accent
        warning: '#FBBF24',    // Orange/Yellow accent
        border: '#333333',
        input: '#2A2A2A'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
