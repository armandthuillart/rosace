<div align="center">

<img src="./.github/image.png" alt="Rosace" width="128" />

# Rosace

[![Astro](https://img.shields.io/badge/Astro-^6.1-FF5D01?style=flat-square&logo=astro&logoColor=white)](https://astro.build/) [![Svelte](https://img.shields.io/badge/Svelte-^5.55-FF3E00?style=flat-square&logo=svelte&logoColor=white)](https://svelte.dev/) [![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.2-38B2AC?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/) [![Vite+](https://img.shields.io/badge/Vite+-0.1.18-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)

An animation-focused web platform with a public site, an authenticated dashboard, and a serverless backend.

</div>

## Why Rosace

Rosace is a modern monorepo designed for building rich animated web experiences with a clean separation between:

- marketing pages (`Astro`)
- product UI (`SvelteKit`)
- backend logic and data (`Convex`)

This structure keeps product surfaces independent while sharing auth, RPC, and backend contracts across the workspace.

> [!NOTE]
> This repository uses **Vite+** (`vp`) as the single toolchain entry point. Use `vp` commands instead of `npm`, `pnpm`, or direct `bun` commands.

## Workspace Layout

| Path                   | Description                                       |
| ---------------------- | ------------------------------------------------- |
| `apps/marketing`       | Public Astro site                                 |
| `apps/dashboard`       | SvelteKit dashboard and app UI                    |
| `packages/convex`      | Convex schema, functions, and backend integration |
| `packages/better-auth` | Shared Better Auth integration                    |
| `packages/crpc`        | Typed RPC runtime and generator                   |

## Getting Started

### Prerequisites

- `vp` installed globally
- access to the environment values required by `.env.template`

### 1) Install dependencies

```bash
vp install
```

### 2) Prepare environment files

```bash
vp run prepare
```

This generates/updates local env files from the workspace template flow.

### 3) Run apps locally

```bash
vp run dashboard#dev
vp run marketing#dev
```

Default local URLs:

- Dashboard: `http://localhost:5173`
- Marketing: `http://localhost:4321`

## Environment Variables

Root template keys (`.env.template`):

- `CONVEX_SITE_URL`
- `CONVEX_URL`
- `DASHBOARD_URL`
- `MARKETING_URL`

> [!TIP]
> Dashboard Cloudflare runtime values are set in `apps/dashboard/wrangler.json` (`PUBLIC_CONVEX_SITE_URL`, `PUBLIC_CONVEX_URL`, `PUBLIC_DASHBOARD_URL`, `PUBLIC_MARKETING_URL`).

## Common Commands

| Command                   | Purpose                                 |
| ------------------------- | --------------------------------------- |
| `vp run dashboard#dev`    | Start dashboard in development mode     |
| `vp run marketing#dev`    | Start marketing app in development mode |
| `vp run dashboard#build`  | Build dashboard                         |
| `vp run marketing#build`  | Build marketing app                     |
| `vp run dashboard#deploy` | Deploy dashboard via Wrangler           |
| `vp run marketing#deploy` | Deploy marketing app via Wrangler       |
| `vp check`                | Run format/lint/type checks             |
| `vp lint`                 | Run linter                              |
| `vp fmt`                  | Format source code                      |
| `vp test`                 | Run tests                               |

## Deployment

Each app is deployed independently to Cloudflare Workers with its own config:

- `apps/dashboard/wrangler.json`
- `apps/marketing/wrangler.json`

Typical flow:

```bash
vp run dashboard#build
vp run dashboard#deploy

vp run marketing#build
vp run marketing#deploy
```

> [!IMPORTANT]
> Keep production URLs and Convex endpoints aligned between env files and `wrangler.json` variables before deploying.

## Stack

- Astro + Tailwind CSS (marketing)
- SvelteKit + Tailwind CSS (dashboard)
- Convex (backend, data, serverless functions)
- Better Auth (authentication)
- Cloudflare Workers + Wrangler (runtime/deployment)
