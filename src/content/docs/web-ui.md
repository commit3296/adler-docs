---
title: Web UI
description: The SolidJS SPA bundled with adler — live SSE streaming, history, side-by-side diff, access engine view, per-scan egress subset.
---

<p class="audience-badge audience-operator">For operators · running scans</p>
<span class="type-chip type-howto">How-to</span>

`adler --web` boots a small in-process HTTP server and serves a SolidJS
SPA from the same binary — no separate frontend deployment, no extra
process to manage. Once the server is up, kick off scans, watch outcomes
stream in over SSE, persist them to disk, and diff them against earlier
runs.

```bash
adler --web                          # http://127.0.0.1:8080
adler --web --web-bind 0.0.0.0:9000  # listen on all interfaces, custom port
```

## What you get in the browser

### Live scan view

Outcomes stream in as they resolve (SSE), grouped by category, with
per-row evidence (verdict reason, response snippet, URL) and a one-click
retry.

The hero input has a **single / batch tab pair**: single takes one
username (the canonical scan); batch
<span class="since-chip">since v0.13</span> takes a textarea that
splits on newline or comma, dedupes, trims, and runs each username
sequentially as its own scan. Parallel batch would multiply per-host
throttle pressure across the whole registry. A `BatchStrip` above the
results shows one chip per username with live status (queued →
running → done(+found) | error); chips become clickable once the
whole run finishes so navigating mid-run doesn't close the in-flight
SSE stream and stall the queue. Same effect as `adler --input
users.txt` on the CLI.

<figure class="screenshot">
  <img src="/screenshots/01-live-scan.webp"
       alt="Live scan view: outcomes streaming in by category"
       loading="lazy" />
  <figcaption>Live scan view, mid-stream. Categories on the left, outcomes painting as SSE events arrive.</figcaption>
</figure>

### Result rows

Each row shows the verdict (Found / NotFound / Uncertain), the elapsed
time, the verdict reason for Uncertain rows, and a small **`transport`
chip** <span class="since-chip">since v0.10</span> when the probe used anything other than the default HTTP transport
— `impersonate` or `browser`. A `*` suffix (e.g. `browser*`) marks an
outcome where the cheap path returned an
`Uncertain(cloudflare_challenge | rate_limited)` and the router
automatically escalated through the browser. The common Http+0 case
stays uncluttered.

<figure class="screenshot">
  <img src="/screenshots/02-result-row-detail.webp"
       alt="ResultRow close-up with transport chip and escalation marker"
       loading="lazy" />
  <figcaption>The <code>browser*</code> chip on the meta column marks an outcome where the cheap HTTP path returned <code>Uncertain(cloudflare_challenge)</code> and the router automatically escalated.</figcaption>
</figure>

### History

Every finished scan is persisted to `~/.cache/adler/scans/` (oldest 200,
atomic writes). Reopen any past scan via `#/scan/<id>` deep-links.

<figure class="screenshot">
  <img src="/screenshots/03-history-modal.webp"
       alt="History drawer with the last few scans"
       loading="lazy" />
  <figcaption>The History drawer (clock icon) lists every finished scan. Click any row to reopen, or arm a scan as the "compare with" source for a diff.</figcaption>
</figure>

### Compare with previous

Pick any two persisted scans and diff them side-by-side (`#/diff/<a>/<b>`);
shows accounts gained / lost / flipped between the two runs. Esc /
back-button exits.

The scan header's **Compare with previous** button
<span class="since-chip">since v0.13</span> opens a picker listing
every other finished scan of the same username, newest first. The
first row is labelled *Most recent* and autofocused, so pressing
Enter keeps the old auto-pick-newest default for the common case;
clicking any other row diffs against that specific historical scan.
Each row shows the relative timestamp ("3h ago"), found/total/elapsed
metadata, and the absolute timestamp on the right.

<figure class="screenshot">
  <img src="/screenshots/04-diff-view.webp"
       alt="Side-by-side diff of two scans of the same username"
       loading="lazy" />
  <figcaption>Diff view at <code>#/diff/&lt;a&gt;/&lt;b&gt;</code>. Accounts gained, lost, and flipped between the two runs surface in three columns.</figcaption>
</figure>

### Filters & sort

By verdict, category, presence of evidence, hidden NotFound rows. Preferences
persist to `localStorage`.

### NSFW gate

Off by default; the toggle is hidden behind a confirmation, matching the
CLI's `--nsfw` opt-in.

### Access engine view <span class="since-chip">since v0.11</span>

The shield icon in the top bar opens a read-only panel showing what's
loaded from `--proxy-pool` (name, country, kind per egress — *never*
proxy URLs) and `--sessions` (names only, never header values).
Sensitive material is kept off the HTTP API by design; editing happens
by updating the TOML files and restarting the server.

<figure class="screenshot">
  <img src="/screenshots/05-access-modal.webp"
       alt="Access engine modal: egress pool and session names, no secrets"
       loading="lazy" />
  <figcaption>The shield icon's modal: configured egresses (name, country, kind) and session names. Proxy URLs and session header values never appear in any HTTP API response.</figcaption>
</figure>

### Per-scan egress subset <span class="since-chip">since v0.11</span>

When a pool is loaded, Advanced filters shows an Egress section that
toggles named entries from the pool; the next scan routes through that
subset only. Sites whose access policy can't be satisfied by the chosen
subset land in `Uncertain(geo_unavailable)` — same honest verdict as if
no egress matched at all.

## JSON API

The server exposes a small JSON API at `/api/*` — useful if you want to
drive Adler from a different frontend or a script:

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/api/health` | Liveness probe. |
| `GET`  | `/api/sites` | Site catalogue available to scans. |
| `GET`  | `/api/access` | Read-only access-engine view (no secrets). |
| `GET`  | `/api/scans` | Recent scans (in-memory + persisted). |
| `POST` | `/api/scan` | Start a scan; returns a `scan_id`. |
| `GET`  | `/api/scan/:id` | Final aggregate (or 202 in-progress / 404). |
| `GET`  | `/api/scan/:id/stream` | Server-Sent Events stream of outcomes. |
| `POST` | `/api/scan/:id/retry` | Re-probe a single site. |

SSE consumers should subscribe to the `/stream` endpoint and treat each
event as one outcome.

### Per-scan egress in `POST /api/scan`

The request body accepts an optional `egress_names: string[]` field;
when non-empty, the scan routes through only the named subset of the
pool. Unknown names return a `400 unknown_egress` error with the bad
entries enumerated in the `message` field — a typo shouldn't silently
turn into "nothing matched".

```json
POST /api/scan
{
  "username": "alice",
  "tag": ["dev"],
  "egress_names": ["us-residential"]
}
```

## Deployment

The bundled SPA is baked into the binary at compile time (`rust-embed`),
so the deployed unit is just the `adler` executable plus whatever scan-
cache directory you point it at.

The SolidJS project lives at `adler-server/web/`; if you build from
source, run `npm ci && npm run build` there before `cargo build` — Vite
emits `web/dist/`, which `rust-embed` reads directly.

## Security notes

`adler --web` binds to `127.0.0.1` by default. `--web-bind 0.0.0.0:9000`
exposes the API on every interface; if you do that, **anyone on the
network can reach the JSON API**. The access-engine endpoints
deliberately omit proxy URLs and session header values so even an
exposed `/api/access` won't leak secrets — but a wide-open `POST
/api/scan` still lets a stranger consume your `--proxy-pool` and
`--browser-budget`. Put a reverse proxy with auth in front of any
non-loopback bind.
