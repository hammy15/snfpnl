const preset = require('../tailwind.preset')

import type { Config } from 'tailwindcss'

const config: Config = {
  presets: [preset],
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

export default config
