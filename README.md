<div align="center">

<img src=".github/image.png" alt="Rosace" height="80" />

# Rosace

A full-stack TypeScript monorepo with two web apps and shared backend/auth packages.

</div>

## Quick Start

```bash
# Install
vp install

# Create env files
cp .env.template .env.development
cp .env.template .env.production
```

Edit both `.env.*` files with required values:

- `CONVEX_SITE_URL`
- `CONVEX_URL`
- `DASHBOARD_URL`
- `MARKETING_URL`

```bash
# Prepare app envs and start dev
vp run prepare
vp dev
```

## Apps

| App              | Framework | URL              |
| ---------------- | --------- | ---------------- |
| `apps/marketing` | Astro     | `rosace.app`     |
| `apps/dashboard` | SvelteKit | `app.rosace.app` |

## Packages

| Package             | Description                        |
| ------------------- | ---------------------------------- |
| `@repo/crpc`        | Typed RPC runtime + CLI            |
| `@repo/convex`      | Backend functions + cRPC adapter   |
| `@repo/better-auth` | Auth helpers for Convex and Svelte |

## Commands

```bash
# Workspace
vp check          # Format, lint, type-check
vp test           # Run tests

# Dashboard
vp run dashboard#dev
vp run dashboard#build
vp run dashboard#deploy

# Marketing
vp run marketing#dev
vp run marketing#build
vp run marketing#deploy
```

## Tech Stack

- **Frontend:** Astro, SvelteKit, Tailwind CSS, GSAP
- **Backend:** Convex, Hono
- **Auth:** Better Auth
- **Infra:** Cloudflare Workers + Wrangler
- **Tooling:** Bun + Vite+ (`vp`)

## Troubleshooting

> [!TIP]
> If app env files are stale, run `vp run prepare` to regenerate them.

> [!TIP]
> After dependency changes, run `vp install` then `vp check` + `vp test`.
