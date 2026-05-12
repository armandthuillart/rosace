import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite-plus';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    server: {
      allowedHosts: [env.DASHBOARD_URL.replace(/^https?:\/\//, '')],
    },
    plugins: [tailwindcss(), sveltekit()],
  };
});
