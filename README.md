<div align="center">

<img src="./.github/icon.png" alt="Rosace" width="128" />

# Rosace

An animation-focused web platform built as a monorepo with an Astro marketing site, a SvelteKit dashboard, and a Convex-backed serverless app layer.

</div>

> [!NOTE]
> Use `vp` commands for installs, checks, builds, and local development. Do not use `npm`, `pnpm`, or `bun` directly.

## Overview

Rosace is organized into a small set of focused apps and shared packages:

| Path                   | Purpose                                                 |
| ---------------------- | ------------------------------------------------------- |
| `apps/marketing`       | Public Astro site for the product and content           |
| `apps/dashboard`       | SvelteKit dashboard and authenticated app UI            |
| `packages/convex`      | Convex schema, functions, emails, and app backend logic |
| `packages/better-auth` | Shared Better Auth integration helpers                  |
| `packages/crpc`        | Type-safe RPC and code generation utilities             |

## Getting Started

1. Create your local environment file.

   ```bash
   cp .env.template .env.development
   ```

2. Install dependencies.

   ```bash
   vp install
   ```

3. Prepare local env files.

   ```bash
   vp run prepare
   ```

4. Start the apps.

   ```bash
   vp dev
   ```

The marketing site runs on `http://localhost:4321` and the dashboard runs on `http://localhost:5173`.

## Environment Variables

The root `.env.template` expects these values:

- `CONVEX_SITE_URL`
- `CONVEX_URL`
- `DASHBOARD_URL`
- `MARKETING_URL`

> [!TIP]
> The dashboard also reads public runtime values through `wrangler.json`, including `PUBLIC_CONVEX_SITE_URL`, `PUBLIC_CONVEX_URL`, `PUBLIC_DASHBOARD_URL`, and `PUBLIC_MARKETING_URL`.

## Common Commands

| Command         | Action                                   |
| --------------- | ---------------------------------------- |
| `vp dev`        | Run local development servers            |
| `vp check`      | Run formatting, linting, and type checks |
| `vp lint`       | Lint the workspace                       |
| `vp fmt`        | Format the workspace                     |
| `vp build`      | Build all apps and packages              |
| `vp preview`    | Preview production builds                |
| `vp run deploy` | Deploy via Cloudflare Wrangler           |

## Deployment

Each app has its own Cloudflare config:

- `apps/marketing/wrangler.json`
- `apps/dashboard/wrangler.json`

Build first, then deploy the app you want to publish.

```bash
vp build
vp run deploy
```

## Notes

- The repository uses Vite+ as the workspace toolchain.
- Shared packages are referenced through workspace imports like `@repo/convex` and `@repo/better-auth`.
- Cloudflare Workers is the target runtime for the deployed apps.
