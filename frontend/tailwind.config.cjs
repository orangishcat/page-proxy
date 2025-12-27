module.exports = {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        gray: {
          950: '#222121',
          900: '#2d2d2c',
          800: '#393a34',
          300: '#d9d9d9',
          100: '#f8f2e2'
        },
        primary: {
          500: '#fbb124',
          400: '#efda39',
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
      }
    }
  },
  plugins: []
};
