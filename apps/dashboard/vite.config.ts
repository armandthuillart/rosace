import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  server: {
    allowedHosts: [process.env.DASHBOARD_URL!.replace(/^https?:\/\//, "")],
  },
  plugins: [tailwindcss(), sveltekit()],
});
