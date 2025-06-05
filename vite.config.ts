import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [
        require('tailwindcss')({
          content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
          theme: { extend: {} },
        }),
        require('autoprefixer'),
      ],
    },
  },
});