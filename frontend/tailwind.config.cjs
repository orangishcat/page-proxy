module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        gray: {
          950: '#222121',
          900: '#2d2d2c',
          800: '#393a34',
          700: '#3a4234',
          600: '#4a5443',
          500: '#6a755f',
          400: '#8c987e',
          300: '#b2bea3',
          200: '#d2dcc6',
          100: '#eef3e7'
        },
        primary: {
          400: '#fbb124',
          500: '#efda39',
          600: '#dac300'
        },
        secondary: {
          500: '#86d24b',
          700: '#5a6c4c'
        },
        accent: {
          500: '#cb9227',
          600: '#ab9904'
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui']
      },
      keyframes: {
        'dialog-in': {
          '0%': { opacity: '0', transform: 'translate(-50%, -50%) scale(0.96)' },
          '100%': { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' }
        },
        'dialog-out': {
          '0%': { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' },
          '100%': { opacity: '0', transform: 'translate(-50%, -50%) scale(0.96)' }
        }
      },
      animation: {
        'dialog-in': 'dialog-in 160ms ease-out',
        'dialog-out': 'dialog-out 120ms ease-in'
      }
    }
  },
  plugins: []
};
