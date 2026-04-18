<div align="center">

# Rosace

[![Astro](https://img.shields.io/badge/Astro-^6.1-FF5D01?style=flat-square&logo=astro&logoColor=white)](https://astro.build/)
[![Svelte](https://img.shields.io/badge/Svelte-^5.55-FF3E00?style=flat-square&logo=svelte&logoColor=white)](https://svelte.dev/)
[![GSAP](https://img.shields.io/badge/GSAP-^3.15-88CE02?style=flat-square&logo=greensock&logoColor=white)](https://gsap.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.2-38B2AC?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Convex](https://img.shields.io/badge/Convex-^1.35-FF7357?style=flat-square)](https://convex.dev/)
[![Vite+](https://img.shields.io/badge/Vite+-0.1.18-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)

</div>

A new type of animation tool. Built with an Astro marketing site, a SvelteKit dashboard, and a serverless backend powered by Convex.

> [!NOTE]
> Use `vp` commands instead of `npm`, `pnpm`, or `bun`. Vite+ handles all dependencies, formatting, and tasks.

## Setup

```bash
cp .env.template .env.development
# Add your Convex and local URLs to .env.development

vp install
vp run prepare
vp dev
```

The marketing site runs at `http://localhost:4321`. The dashboard runs at `http://localhost:5173`.

## Commands

| Command         | Action              |
| --------------- | ------------------- |
| `vp dev`        | Start dev servers   |
| `vp check`      | Check types         |
| `vp lint`       | Lint code           |
| `vp fmt`        | Format code         |
| `vp build`      | Build applications  |
| `vp preview`    | Test build          |
| `vp run deploy` | Deploy via Wrangler |

## Architecture

Apps live in `apps/`. Shared packages live in `packages/`.

- `apps/marketing` (Astro site)
- `apps/dashboard` (SvelteKit app)
- `packages/convex` (Database schema and API)
- `packages/better-auth` (Authentication logic)
- `packages/crpc` (Type-safe RPC wrapper)

## Deploy

```bash
vp build
vp run deploy
```
