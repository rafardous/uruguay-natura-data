import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // El panel comparte documentos TS con la app sin instalar Expo en Cloudflare.
  // Una cadena evita que Vite busque el tsconfig móvil para esos documentos.
  esbuild: {
    tsconfigRaw: JSON.stringify({ compilerOptions: {
      target: 'ES2022', useDefineForClassFields: true, jsx: 'react-jsx',
    } }),
  },
  build: { target: 'es2022', sourcemap: true },
});
