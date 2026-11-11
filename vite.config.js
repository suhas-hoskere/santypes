import { defineConfig } from 'vite';

const commonHeaders = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
};

export default defineConfig({
  root: './',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 0,
  },
  server: {
    port: 3000,
    open: true,
    headers: {
      ...commonHeaders,
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self' https://www.googletagmanager.com; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: https://www.google-analytics.com; connect-src 'self' ws: wss: https://api.web3forms.com https://www.google-analytics.com https://analytics.google.com https://region1.google-analytics.com https://*.analytics.google.com; manifest-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'none'",
    },
  },
  preview: {
    headers: {
      ...commonHeaders,
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self' https://www.googletagmanager.com; script-src-attr 'none'; style-src 'self'; style-src-elem 'self'; style-src-attr 'unsafe-inline'; font-src 'self'; img-src 'self' data: https://www.google-analytics.com; connect-src 'self' https://api.web3forms.com https://www.google-analytics.com https://analytics.google.com https://region1.google-analytics.com https://*.analytics.google.com; manifest-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'none'",
    },
  },
});
