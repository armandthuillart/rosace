import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, envField } from 'astro/config';

export default defineConfig({
  env: {
    schema: {
      DASHBOARD_URL: envField.string({
        access: 'public',
        context: 'client',
      }),
      MARKETING_URL: envField.string({
        access: 'public',
        context: 'client',
      }),
    },
    validateSecrets: true,
  },
  integrations: [mdx(), sitemap()],
  site: 'https://rosace.app',
  vite: {
    plugins: [tailwindcss()],
  },
});
