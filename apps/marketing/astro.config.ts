import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { getEnv } from "@repo/env";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, envField, fontProviders } from "astro/config";

export default defineConfig({
	adapter: cloudflare(),
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
			provider: fontProviders.google(),
			weights: [300, 400, 500, 600],
		},
	],
	integrations: [mdx(), sitemap()],
	site: getEnv().MARKETING_URL,
	vite: {
		plugins: [tailwindcss()],
	},
});
