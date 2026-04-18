# Rosace

<p align="center">
  <img src=".github/image.png" alt="Rosace banner" />
</p>

Rosace is a monorepo for the product website and authenticated app experience, with shared backend/auth packages used across both surfaces.

## What Is In This Repo

- `apps/marketing`: Astro marketing site (`rosace.app`)
- `apps/dashboard`: SvelteKit dashboard app (`app.rosace.app`)
- `packages/crpc`: typed RPC/runtime primitives and CLI
- `packages/convex`: Convex backend package plus cRPC adapter exports
- `packages/better-auth`: Better Auth integration helpers for Convex and Svelte

## Tech Stack

- Frontend: Astro, SvelteKit, Tailwind CSS, GSAP
- Backend and APIs: Convex, Hono, Better Auth, cRPC
- Infra and deploy: Cloudflare Workers + Wrangler
- Tooling: Bun workspaces + Vite+ (`vp`)

## Prerequisites

- Bun (`packageManager` is `bun@1.3.12`)
- Vite+ CLI (`vp`) available in your shell

> [!IMPORTANT]
> This repository uses Vite+ workflow conventions. Use `vp` commands for install/check/test tasks.

## Getting Started

1. Install dependencies:

   ```bash
   vp install
   ```

2. Create root env files (copy from template):

   ```bash
   cp .env.template .env.development
   cp .env.template .env.production
   ```

3. Fill required values in both files:
   - `CONVEX_SITE_URL`
   - `CONVEX_URL`
   - `DASHBOARD_URL`
   - `MARKETING_URL`

4. Prepare app-level env files (runs automatically on install via `prepare`, but can be run manually):

   ```bash
   vp run prepare
   ```

## Development Commands

Run commands from the repository root unless noted.

### Workspace

```bash
vp check
vp test
```

### Dashboard (`apps/dashboard`)

```bash
vp run dashboard#dev
vp run dashboard#build
vp run dashboard#check
vp run dashboard#preview
```

### Marketing (`apps/marketing`)

```bash
vp run marketing#dev
vp run marketing#build
vp run marketing#check
vp run marketing#preview
```

> [!NOTE]
> App scripts are defined inside each workspace package and are intentionally different: dashboard uses Vite+/SvelteKit commands while marketing uses Astro commands.

## Deployment

Both apps are configured for Cloudflare Workers via Wrangler:

- `apps/dashboard/wrangler.json` (`name: rosace-dashboard`)
- `apps/marketing/wrangler.json` (`name: rosace-marketing`)

Deploy from each app workspace:

```bash
vp run dashboard#deploy
vp run marketing#deploy
```

## Architecture Snapshot

- `apps/dashboard` authenticates users via Better Auth and syncs auth state with Convex.
- `packages/convex` contains backend function exports and integration points used by the app.
- `packages/crpc` provides typed building blocks used by Convex-facing code.
- `apps/marketing` is a static-first Astro site for product narrative and acquisition.

## Troubleshooting

> [!TIP]
> If app env files look stale or missing, re-run `vp run prepare` to regenerate `apps/dashboard/.env.development`, `apps/marketing/.env.development`, and `apps/marketing/.env.production` from root env files.

> [!TIP]
> If checks fail after dependency changes, run `vp install` again, then `vp check` and `vp test`.
