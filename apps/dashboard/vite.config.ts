import { cloudflare } from "@cloudflare/vite-plugin";
import { getEnv } from "@repo/env";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const env = getEnv();

export default defineConfig({
	define: {
		"import.meta.env.VITE_CONVEX_SITE_URL": JSON.stringify(env.CONVEX_SITE_URL),
		"import.meta.env.VITE_CONVEX_URL": JSON.stringify(env.CONVEX_URL),
		"import.meta.env.VITE_DASHBOARD_URL": JSON.stringify(env.DASHBOARD_URL),
		"import.meta.env.VITE_MARKETING_URL": JSON.stringify(env.MARKETING_URL),
	},
	plugins: [
		cloudflare({
			viteEnvironment: {
				name: "ssr",
			},
		}),
		tailwindcss(),
		tanstackStart(),
		babel({
			include: [/\.[jt]sx$/u],
			parserOpts: {
				plugins: ["typescript", "jsx"],
			},
			presets: [reactCompilerPreset()],
		}),
		viteReact(),
	],
	resolve: {
		tsconfigPaths: true,
	},
});
