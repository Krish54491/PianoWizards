import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
  server: {
    port: 5173,
    host: '0.0.0.0', // Listen on all interfaces
    allowedHosts: [
      'pianowizards.jacob-smoot.ts.net',
      'pianowizards.andrewklundt.com',
    ],
    fs: {
      // Allow serving files from one level up (for media folder)
      allow: ['..'],
    },
  },
  publicDir: '../media', // Serve media folder as public assets
});
