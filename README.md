<div align="center">

<img src=".github/image.png" alt="Rosace" height="80" />

# Rosace

A monorepo powering the product website and authenticated app experience, with shared backend and auth packages across both surfaces.

</div>

## Overview

Rosace is a full-stack TypeScript monorepo containing two web applications—an Astro-based marketing site and a SvelteKit dashboard with user authentication—alongside shared packages for the backend, typed RPC primitives, and auth integration.

## Features

- **Static-first marketing site** - Astro-powered site for product narrative and acquisition
- **Authenticated dashboard** - SvelteKit app with Better Auth integration and Convex sync
- **Typed RPC layer** - cRPC building blocks for type-safe client-server communication
- **Backend functions** - Convex functions with Hono HTTP adapters and auth hooks
- **Cloudflare-ready** - Both apps deploy to Cloudflare Workers via Wrangler

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│ apps/marketing  │     │  apps/dashboard │
│    (Astro)      │     │   (SvelteKit)   │
│  rosace.app     │     │ app.rosace.app  │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │       ┌──────────────┴──────────────┐
         │       │       packages/crpc          │
         │       │    typed RPC + runtime      │
         │       └──────────────┬──────────────┘
         │                       │
         │   ┌──────────────────┴──────────────────┐
         │   │           packages/convex              │
         │   │      backend functions + adapters   │
         │   └──────────────────┬──────────────────┘
         │                       │
         │   ┌──────────────────┴──────────────────┐
         │   │        packages/better-auth           │
         │   │     auth integration helpers        │
         │   └─────────────────────────────────────┘
```

## Tech Stack

| Layer    | Technology                           |
| -------- | ------------------------------------ |
| Frontend | Astro, SvelteKit, Tailwind CSS, GSAP |
| Backend  | Convex, Hono                         |
| Auth     | Better Auth                          |
| RPC      | cRPC                                 |
| Infra    | Cloudflare Workers + Wrangler        |
| Tooling  | Bun + Vite+ (`vp`)                   |

## Prerequisites

- [Bun](https://bun.sh) (`packageManager` in `package.json` is `bun@1.3.12`)
- [Vite+ CLI](https://vite-plus.dev) (`vp`) in your shell

> [!IMPORTANT]
> This repository uses Vite+ workflow conventions. Use `vp` commands for install/check/test tasks.

## Quick Start

```bash
# Install dependencies
vp install

# Create root env files
cp .env.template .env.development
cp .env.template .env.production
```

Edit both `.env.*` files with required values:

- `CONVEX_SITE_URL`
- `CONVEX_URL`
- `DASHBOARD_URL`
- `MARKETING_URL`

```bash
# Prepare app-level env files
vp run prepare

# Start both apps
vp dev
```

## Development Commands

Run from the repository root.

### Workspace

```bash
vp check       # Format, lint, and type-check
vp test        # Run tests
```

### Dashboard (`apps/dashboard`)

```bash
vp run dashboard#dev       # Start dev server
vp run dashboard#build    # Build for production
vp run dashboard#check   # Type-check
vp run dashboard#preview  # Preview production build
```

### Marketing (`apps/marketing`)

```bash
vp run marketing#dev     # Start dev server
vp run marketing#build    # Build for production
vp run marketing#check   # Type-check
vp run marketing#preview # Preview production build
```

> [!NOTE]
> App scripts differ by framework: dashboard uses Vite+/SvelteKit commands while marketing uses Astro commands.

## Deployment

Both apps deploy to Cloudflare Workers via Wrangler:

| App              | Worker name        | Command                   |
| ---------------- | ------------------ | ------------------------- |
| `apps/dashboard` | `rosace-dashboard` | `vp run dashboard#deploy` |
| `apps/marketing` | `rosace-marketing` | `vp run marketing#deploy` |

## Packages

| Package             | Description                               |
| ------------------- | ----------------------------------------- |
| `@repo/crpc`        | Typed RPC runtime primitives and CLI      |
| `@repo/convex`      | Convex backend functions + cRPC adapter   |
| `@repo/better-auth` | Better Auth helpers for Convex and Svelte |

## Troubleshooting

> [!TIP]
> If app env files look stale or missing, re-run `vp run prepare` to regenerate `apps/dashboard/.env.development`, `apps/marketing/.env.development`, and `apps/marketing/.env.production` from root env files.

> [!TIP]
> If checks fail after dependency changes, run `vp install` followed by `vp check` and `vp test`.
