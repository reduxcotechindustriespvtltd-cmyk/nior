# Specter

> Kill-switch infrastructure for modern web applications.

Specter lets you remotely disable, freeze, redirect, or gracefully degrade any web property in seconds — without a deployment. Drop in one script tag, configure your rules via the dashboard or CLI, and pull the lever whenever you need to.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Setup](#setup)
4. [API Reference](#api-reference)
5. [SDK Integration](#sdk-integration)
6. [CLI Usage](#cli-usage)
7. [Kill Modes](#kill-modes)
8. [Pricing](#pricing)
9. [Security](#security)

---

## Overview

Specter consists of four layers:

| Layer | Package | Purpose |
|-------|---------|---------|
| **API** | `apps/api` | REST API — auth, site management, kill-switch triggers |
| **SDK** | `packages/sdk` | Ultra-lightweight browser script that polls/listens for kill events |
| **CLI** | `packages/cli` | Developer CLI for managing sites from the terminal |
| **Dashboard** | `apps/web` | Next.js management console |

---

## Architecture

```
 Developer / Ops
      │
      │  specter kill <siteId> --mode overlay
      ▼
 ┌──────────────┐     HTTPS/REST      ┌─────────────────────────┐
 │  Specter CLI │ ─────────────────►  │   Specter API           │
 │  (Node.js)   │                     │   (Fastify / Node)      │
 └──────────────┘                     │                         │
                                      │  ┌─────────────────┐   │
 ┌──────────────┐     HTTPS/REST      │  │  PostgreSQL      │   │
 │  Dashboard   │ ─────────────────►  │  │  (sites, events) │  │
 │  (Next.js)   │                     │  └─────────────────┘   │
 └──────────────┘                     │  ┌─────────────────┐   │
                                      │  │  Redis          │   │
                                      │  │  (kill state)   │   │
                                      │  └─────────────────┘   │
                                      └────────────┬────────────┘
                                                   │
                                          CDN push / SSE
                                                   │
                                                   ▼
                                      ┌────────────────────────┐
                                      │   CDN Edge             │
                                      │   cdn.specter.sh       │
                                      │   (CloudFront / R2)    │
                                      └────────────┬───────────┘
                                                   │  specter.min.js
                                                   │  (~3 kB gzip)
                                                   ▼
                                      ┌────────────────────────┐
                                      │   End-User Browser     │
                                      │                        │
                                      │  <script data-sid="…"> │
                                      │  polls /v1/state/:sid  │
                                      │  every 30 s (SSE live) │
                                      └────────────────────────┘
```

**Data flow for a kill event:**

```
1. Operator triggers kill  →  API writes state to Redis + Postgres
2. API fans out SSE event  →  all connected SDK instances receive it instantly
3. SDK not on SSE (poll)   →  picks up change on next 30-second poll
4. SDK executes kill mode  →  freeze / overlay / redirect / ghost / timebomb
```

---

## Setup

### Prerequisites

- Node.js >= 20
- pnpm >= 9
- Docker (for local Postgres + Redis)

### 1. Clone and install

```bash
git clone https://github.com/your-org/specter.git
cd specter
pnpm install
```

### 2. Environment variables

Copy `.env.example` to `.env` in each app:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

**`apps/api/.env`**

```env
DATABASE_URL=postgresql://specter:specter@localhost:5432/specter
REDIS_URL=redis://localhost:6379
JWT_SECRET=change_me_in_production
JWT_EXPIRY=7d
CDN_BASE=https://cdn.specter.sh
PORT=3001
```

**`apps/web/.env`**

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_CDN_BASE=https://cdn.specter.sh
```

### 3. Start infrastructure

```bash
docker compose up -d        # starts postgres + redis
pnpm --filter api db:migrate
pnpm --filter api db:seed   # optional demo data
```

### 4. Run in development

```bash
pnpm dev                    # runs all apps via Turborepo
```

### 5. Install the CLI globally

```bash
npm install -g @specter/cli
specter --version
```

---

## API Reference

All API endpoints are prefixed with `/v1`. Authentication uses Bearer tokens.

```
Authorization: Bearer <jwt>
```

### Authentication

#### `POST /v1/auth/register`

```json
{
  "email": "dev@example.com",
  "password": "secret"
}
```

**Response 201**

```json
{
  "token": "<jwt>",
  "user": { "id": "usr_…", "email": "dev@example.com" }
}
```

#### `POST /v1/auth/login`

Same body/response shape as register.

---

### Sites

#### `GET /v1/sites`

List all sites for the authenticated account.

**Response 200**

```json
{
  "sites": [
    {
      "id": "site_abc123",
      "name": "My App",
      "domain": "myapp.com",
      "status": "live",
      "killMode": null,
      "siteToken": "tok_…",
      "lastEventAt": "2024-03-01T12:00:00Z",
      "createdAt": "2024-01-15T09:00:00Z"
    }
  ]
}
```

#### `POST /v1/sites`

Create a new site.

```json
{
  "name": "My App",
  "domain": "myapp.com",
  "defaultKillMode": "freeze"
}
```

**Response 201**

```json
{
  "site": { "id": "site_abc123", "siteToken": "tok_…", … }
}
```

#### `GET /v1/sites/:siteId/status`

Get current status for a site.

**Response 200**

```json
{
  "site": {
    "id": "site_abc123",
    "status": "killed",
    "killMode": "overlay",
    "killedAt": "2024-03-01T12:00:00Z",
    "lastEventAt": "2024-03-01T12:00:00Z"
  }
}
```

#### `GET /v1/sites/:siteId/token`

Retrieve the site's embed token.

**Response 200**

```json
{ "siteToken": "tok_…" }
```

---

### Kill Switch

#### `POST /v1/sites/:siteId/kill`

Trigger the kill switch.

```json
{
  "mode": "redirect",
  "redirectUrl": "https://status.myapp.com",
  "scheduledAt": null
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `mode` | string | yes | `freeze` \| `overlay` \| `redirect` \| `ghost` \| `timebomb` |
| `redirectUrl` | string | for redirect mode | Destination URL |
| `scheduledAt` | ISO string | for timebomb mode | When to auto-kill |

**Response 200**

```json
{ "ok": true, "killedAt": "2024-03-01T12:00:00Z" }
```

#### `POST /v1/sites/:siteId/restore`

Restore a killed site.

**Response 200**

```json
{ "ok": true, "restoredAt": "2024-03-01T13:00:00Z" }
```

---

### Events (SSE)

#### `GET /v1/sites/:siteId/events`

Server-Sent Events stream. The SDK connects to this endpoint to receive real-time kill/restore notifications without polling.

```
event: kill
data: {"mode":"freeze","killedAt":"2024-03-01T12:00:00Z"}

event: restore
data: {"restoredAt":"2024-03-01T13:00:00Z"}

event: ping
data: {}
```

---

## SDK Integration

### Install via CDN (recommended)

Add the snippet before `</body>`. Retrieve it from the CLI:

```bash
specter snippet <siteId>
```

Example output:

```html
<script src="https://cdn.specter.sh/specter.min.js"
        data-sid="tok_abc123"
        data-ua="UA-5823019-3"
        data-env="production"
        crossorigin="anonymous"
        data-nonce="x7kQpL2m"
        async></script>
```

The `data-ua` and `data-nonce` attributes are cosmetic camouflage; only `data-sid` is functional.

### Install via npm

```bash
npm install @specter/sdk
```

```ts
import { SpecterSDK } from "@specter/sdk";

const specter = new SpecterSDK({
  siteToken: "tok_abc123",
  endpoint: "https://api.specter.sh",
  pollInterval: 30_000,      // fallback poll ms (default: 30 000)
  useSSE: true,              // real-time via Server-Sent Events (default: true)
});

specter.start();
```

### Custom kill handler

Override the default UI behaviour for any mode:

```ts
specter.onKill((event) => {
  if (event.mode === "freeze") {
    // Block all XHR by monkey-patching fetch
    window.fetch = () => new Promise(() => {});
  }

  if (event.mode === "overlay") {
    document.body.innerHTML = "<h1>We'll be right back.</h1>";
  }

  if (event.mode === "redirect") {
    window.location.href = event.redirectUrl;
  }
});

specter.onRestore(() => {
  window.location.reload();
});
```

### Generating per-site obfuscated variants

For maximum snippet uniqueness:

```bash
# Build the minified SDK first
pnpm --filter sdk build

# Generate generic obfuscated bundle
node packages/sdk/scripts/obfuscate.js

# Generate a site-specific bundle (bakes token as constant)
node packages/sdk/scripts/obfuscate.js --site-token tok_abc123

# Generate variants for all sites listed in sites.json
node packages/sdk/scripts/obfuscate.js --all-sites
```

Generate the HTML snippet programmatically:

```js
const { generateSnippet } = require("./packages/sdk/scripts/generate-snippet");

const html = generateSnippet({
  siteToken: "tok_abc123",
  endpoint: "https://cdn.specter.sh",
  deterministicUa: true,   // stable UA across regenerations
});
// <script src="https://cdn.specter.sh/specter.min.js" data-sid="tok_abc123" ...>
```

---

## CLI Usage

```bash
specter --help
```

### Login / Logout

```bash
# Interactive login
specter login

# Override API base (staging)
specter login --api-base https://api.staging.specter.sh

# Logout
specter logout
```

### Sites

```bash
# Pretty table
specter sites

# Raw JSON (pipe-friendly)
specter sites --json
```

### Kill a site

```bash
# Default mode (freeze) with confirmation prompt
specter kill site_abc123

# Specific mode, skip prompt
specter kill site_abc123 --mode overlay -y

# Redirect mode
specter kill site_abc123 --mode redirect --url https://status.myapp.com

# Scheduled timebomb
specter kill site_abc123 --mode timebomb --at 2024-12-31T23:59:00Z
```

### Restore a site

```bash
specter restore site_abc123
specter restore site_abc123 -y
```

### Check status

```bash
specter status site_abc123
specter status site_abc123 --json
```

### Get embed snippet

```bash
# Print to stdout
specter snippet site_abc123

# Pipe into clipboard (macOS)
specter snippet site_abc123 | pbcopy

# Write to file
specter snippet site_abc123 > snippet.html
```

### Interactive setup wizard

```bash
specter init
```

Walks through login and first-site creation, then prints the embed snippet.

---

## Kill Modes

| Mode | Behaviour | Best For |
|------|-----------|----------|
| `freeze` | Silently blocks all outbound API calls and user interactions | Preventing data writes during incident |
| `overlay` | Displays a full-screen maintenance overlay | Scheduled maintenance windows |
| `redirect` | Sends all visitors to a specified URL | Directing to status page |
| `ghost` | Serves stale cached content without fetching new data | Degraded-but-visible fallback |
| `timebomb` | Schedules an automatic kill at a future timestamp | Sunsetting features / expiring trials |

---

## Pricing

| Tier | Price | Sites | Kill Events / mo | SSE Real-time | SLA |
|------|-------|-------|-----------------|---------------|-----|
| **Hobby** | Free | 2 | 100 | — (poll only) | — |
| **Starter** | $19 / mo | 10 | 5 000 | Yes | 99.5% |
| **Pro** | $79 / mo | 50 | Unlimited | Yes | 99.9% |
| **Enterprise** | Custom | Unlimited | Unlimited | Yes + dedicated | 99.99% |

All paid tiers include: custom domains, audit log, Slack/PagerDuty webhooks, and SSO (Enterprise).

---

## Security

- All API communication is TLS 1.2+.
- Site tokens are one-way hashed before storage; the raw token is only shown once at creation.
- The SDK payload is ~3 kB gzip and has no third-party dependencies.
- Per-site obfuscated variants make cross-site token correlation infeasible.
- Self-defending obfuscation breaks the SDK if a client attempts to beautify and patch it.
- JWT access tokens expire after 7 days; refresh tokens after 30 days.

---

## Contributing

```bash
# Run tests
pnpm test

# Lint
pnpm lint

# Type-check all packages
pnpm typecheck
```

Pull requests welcome. Please open an issue before starting large changes.

---

## License

MIT © Specter Contributors
