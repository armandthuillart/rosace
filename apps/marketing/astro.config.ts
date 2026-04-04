import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { getEnv } from "@repo/env";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, envField, fontProviders } from "astro/config";

export default defineConfig({
  env: {
    schema: {
      DASHBOARD_URL: envField.string({
        access: "public",
        context: "client",
      }),
      MARKETING_URL: envField.string({
        access: "public",
        context: "client",
      }),
    },
    validateSecrets: true,
  },
  fonts: [
    {
      cssVariable: "--font-inter",
      name: "Inter",
      options: {
        variants: [
          {
            style: "normal",
            src: ["./src/assets/fonts/inter-regular.woff2"],
            weight: "400",
          },
          {
            src: ["./src/assets/fonts/inter-medium.woff2"],
            style: "normal",
            weight: "500",
          },
          {
            src: ["./src/assets/fonts/inter-semibold.woff2"],
            style: "normal",
            weight: "600",
          },
        ],
      },
      provider: fontProviders.local(),
    },
  ],
  integrations: [mdx(), sitemap()],
  site: getEnv().MARKETING_URL,
  vite: {
    plugins: [tailwindcss()],
  },
});
