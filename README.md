<div align="center">

# Rosace

[![Astro](https://img.shields.io/badge/Astro-^6.1-FF5D01?style=flat-square&logo=astro&logoColor=white)](https://astro.build/)
[![Svelte](https://img.shields.io/badge/Svelte-^5.55-FF3E00?style=flat-square&logo=svelte&logoColor=white)](https://svelte.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.2-38B2AC?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Vite+](https://img.shields.io/badge/Vite+-0.1.18-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)

</div>

A new type of animation tool. Built with Astro, Svelte, and Convex.

> [!NOTE]
> Use `vp` commands instead of `npm`, `pnpm`, or `bun`.

## Setup

```bash
vp install
vp run prepare
vp run dashboard#dev
```

Dashboard runs at `http://localhost:5173`.
Marketing runs at `http://localhost:4321` (run with `vp run marketing#dev`).

## Commands

| Command                   | Action                            |
| ------------------------- | --------------------------------- |
| `vp run dashboard#dev`    | Start dashboard dev server        |
| `vp run marketing#dev`    | Start marketing dev server        |
| `vp check`                | Run format, lint, and type checks |
| `vp test`                 | Run tests                         |
| `vp lint`                 | Lint code                         |
| `vp fmt`                  | Format code                       |
| `vp run dashboard#build`  | Build dashboard                   |
| `vp run marketing#build`  | Build marketing                   |
| `vp run dashboard#deploy` | Deploy dashboard to Cloudflare    |
| `vp run marketing#deploy` | Deploy marketing to Cloudflare    |

## Workspace

- `apps/dashboard`: SvelteKit app
- `apps/marketing`: Astro site
- `packages/convex`: Convex backend
- `packages/better-auth`: auth integration package
- `packages/crpc`: RPC/runtime utilities

## Environment

Root env keys are defined in `.env.template`:

- `CONVEX_SITE_URL`
- `CONVEX_URL`
- `DASHBOARD_URL`
- `MARKETING_URL`

## Deploy

```bash
vp run dashboard#build
vp run dashboard#deploy

vp run marketing#build
vp run marketing#deploy
```
