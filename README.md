<a href="https://rosace.app">
  <img alt="A preview of the dashboard" src="./.github/cover.png" />
</a>

<p align="center">
  <a href="https://rosace.app">Website</a>
  ·
  <a href="https://app.rosace.app">Dashboard</a>
</p>

> [!NOTE]
> OpenAI is the founding sponsor of the new, open-source Warp repository, and the new agentic management workflows are powered by GPT models.

## About

[Rosace](https://rosace.app) is a fast and simple animation tool on the web.

## Usage

You can [login](https://app.rosace.app/login) or [register](https://app.rosace.app/register) to get started.

## Contributing

### Building locally

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
vp run prepare
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
flowchart TD
  subgraph Frontend
    direction TB
    dashboard["Dashboard<br/>(Svelte 5)"]
    marketing["Marketing<br/>(Astro 6)"]
  end

  subgraph "Backend"
    direction TB
    convex["BaaS<br/>(@repo/convex)"]
    auth["Auth<br/>(@repo/auth)"]
  end

  subgraph "Integrations"
    direction TB
    stripe["Stripe"]
    email["Resend"]
    posthog["PostHog"]
  end

  dashboard --- convex
  marketing --- convex
  auth -.- dashboard
  auth -.- convex
  convex -.- stripe
  convex -.- email
  dashboard -.- posthog

  linkStyle 0 stroke:#a3c9e2,stroke-width:1px
  linkStyle 1 stroke:#ceb6e2,stroke-width:1px,stroke-dasharray:5
  linkStyle 2 stroke:#b9e6c2,stroke-width:1px,stroke-dasharray:6,stroke:#b9e6c2
  linkStyle 3 stroke:#b9e6c2,stroke-width:1px,stroke-dasharray:6,stroke:#b9e6c2
  linkStyle 4 stroke:#aee9e1,stroke-width:1px,stroke-dasharray:5
  linkStyle 5 stroke:#ffd8b6,stroke-width:1px,stroke-dasharray:5
  linkStyle 6 stroke:#f6aec7,stroke-width:1px,stroke-dasharray:4
```

### How it works

This repo has two main apps:

- `apps/marketing`: The public marketing site and changelog.
- `apps/dashboard`: The secure user dashboard (login required).

Supporting packages:

- `packages/convex`: All business logic, including queries, mutations, and actions.
- `packages/auth`: Shared authentication primitives used by both the dashboard and the backend.

## References

- `AGENTS.md` - for tooling rules and review checklist.
- `packages/convex/README.md` - backend conventions and general usage.
- `packages/auth/README.md` - auth flow and required auth configuration.
