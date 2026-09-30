/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'navy': '#01576F',
        'navy-secondary': '#028DB4',
        'orange': '#FF7A00',
        'red-accent': '#FF5A36',
        'bg-light': '#F8F9FC',
        'text-gray': '#7C8491',
      },
      fontFamily: {
        'inter': ['Inter', 'Manrope', 'sans-serif'],
      },
      backgroundImage: {
        'orange-gradient': 'linear-gradient(135deg, #FF7A00 0%, #FF5A36 100%)',
        'orange-gradient-h': 'linear-gradient(90deg, #FF7A00 0%, #FF5A36 100%)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        float2: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        float3: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.3)' },
        },
        pulse_dot: {
          '0%, 100%': { boxShadow: '0 0 6px 2px rgba(255, 80, 30, 0.6)' },
          '50%': { boxShadow: '0 0 16px 8px rgba(255, 80, 30, 0.9)' },
        },
      },
      animation: {
        'float': 'float 3s ease-in-out infinite',
        'float-delay': 'float 3s ease-in-out infinite 0.8s',
        'float-delay2': 'float2 3.5s ease-in-out infinite 1.5s',
        'float-delay3': 'float3 4s ease-in-out infinite 0.4s',
        'float-delay4': 'float 3.2s ease-in-out infinite 1.2s',
        'glow': 'glow 2s ease-in-out infinite',
        'pulse_dot': 'pulse_dot 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
