[![Rosace](./preview.png)](https://rosace.app)

<p align="center">
  <a href="https://rosace.app">Marketing</a>
  ·
  <a href="https://app.rosace.app">Dashboard</a>
</p>

> [!NOTE]
> Rosace runs entirely in the browser, thanks to amazing open-source libraries like [GSAP](https://gsap.com/) and [Three.js](https://threejs.org/).

## About

[Rosace](https://rosace.app) is a fast and simple animation tool on the web.

## Usage

You can [login](https://app.rosace.app/login) or [register](https://app.rosace.app/register) to get started.

## Contributing

### Local development

To get up and running:

### 1) Install dependencies

```bash
vp i
```

### 2) Configure root environment files

Create and populate:

- `.env.development`
- `.env.production`

Start from `.env.template` and fill required values.

### 3) Generate app env files

```bash
vp run env
```

This command reads root env files and writes:

- `apps/dashboard/.env.development`
- `apps/dashboard/.env.production`
- `apps/marketing/.env.development`
- `apps/marketing/.env.production`

### 4) Run apps locally

```bash
vp run dev
```

## Architecture

### Diagram

```mermaid
flowchart LR
  subgraph Frontend
    direction TB
    dashboard["Dashboard<br/>(Svelte 5)"]
    marketing["Marketing<br/>(Astro 6)"]
  end

  subgraph "Packages"
    direction TB
    svelte["Svelte<br/>(@repo/svelte)"]
    convex["Backend<br/>(@repo/convex)"]
    utils["Utilities<br/>(@repo/utils)"]
  end

  subgraph "Integrations"
    direction TB
    stripe["Stripe"]
    posthog["PostHog"]
  end

  dashboard --- svelte
  svelte --- convex
  convex -.- stripe
  convex -.- posthog
  dashboard -.- posthog
  convex --- utils
  svelte --- utils
  dashboard --- utils

  linkStyle 0 stroke:#2563eb,stroke-width:1px,stroke-dasharray:8,4
  linkStyle 1 stroke:#2563eb,stroke-width:1px,stroke-dasharray:8,4
  linkStyle 2 stroke:#0d9488,stroke-width:1px,stroke-dasharray:2,4
  linkStyle 3 stroke:#db2777,stroke-width:1px,stroke-dasharray:2,4
  linkStyle 4 stroke:#db2777,stroke-width:1px,stroke-dasharray:2,4
  linkStyle 5 stroke:#16a34a,stroke-width:1px,stroke-dasharray:4,4
  linkStyle 6 stroke:#16a34a,stroke-width:1px,stroke-dasharray:4,4
  linkStyle 7 stroke:#16a34a,stroke-width:1px,stroke-dasharray:4,4
```

### How it works

This repo has two main apps:

- `apps/marketing`: The public marketing site and changelog.
- `apps/dashboard`: The secure user dashboard (login required).

Supporting packages:

- `packages/convex`: All business logic, including queries, mutations, and actions.
- `packages/svelte`: Bridge layer between the dashboard and Convex — Svelte runes, stores, and utilities consumed by the dashboard.
- `packages/utils`: Shared utilities consumed by convex, svelte, and the dashboard apps.

## References

- `AGENTS.md`: Repository tooling rules and review checklist.
- `packages/convex/README.md`: Backend conventions, auth patterns, and coding standards.
- `packages/svelte/README.md`: How the Svelte bridge layer works.
