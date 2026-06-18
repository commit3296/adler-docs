---
title: Web UI
description: The SolidJS SPA bundled with adler — live SSE streaming, evidence/confidence views, identity clusters, report exports, history, diff, and access engine controls.
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
per-row evidence (verdict reason, response snippet, URL), confidence
chips, and a one-click retry.

<figure>
  <img
    src="/screenshots/01-live-scan.webp"
    alt="Adler Web UI showing a running scan for alice with grouped streaming results, confidence chips, and a browser transport chip."
    loading="lazy"
    decoding="async"
  />
  <figcaption>Running scan view with grouped SSE results and per-row confidence.</figcaption>
</figure>

The hero input has a **single / batch tab pair**: single takes one
username (the canonical scan); batch
<span class="since-chip">since v0.8.3</span> takes a textarea that
splits on newline or comma, dedupes, trims, and runs each username
sequentially as its own scan. Parallel batch would multiply per-host
throttle pressure across the whole registry. A `BatchStrip` above the
results shows one chip per username with live status (queued →
running → done(+found) | error); chips become clickable once the
whole run finishes so navigating mid-run doesn't close the in-flight
SSE stream and stall the queue. Same effect as `adler --input
users.txt` on the CLI.

### Result rows

Each row shows the verdict (Found / NotFound / Uncertain), the elapsed
time, the verdict reason for Uncertain rows, and a small **`transport`
chip** <span class="since-chip">since v0.10</span> when the probe used anything other than the default HTTP transport
— `impersonate` or `browser`. A `*` suffix (e.g. `browser*`) marks an
outcome where the cheap path returned an
`Uncertain(cloudflare_challenge | rate_limited)` and the router
automatically escalated through the browser. The common Http+0 case
stays uncluttered.

Confidence chips show the explainable score label (`high`, `medium`,
`low`) computed by the core rule set. Expanding a row opens the evidence
drawer: signal evidence, confidence reasons, structured
`profile_evidence`, transport, escalation count, and non-secret evidence
source metadata when present.

<figure>
  <img
    src="/screenshots/02-result-row-detail.webp"
    alt="Finished Adler scan with a GitHub result row expanded to show confidence reasons, signal evidence, profile evidence, and report export links."
    loading="lazy"
    decoding="async"
  />
  <figcaption>Expanded result row showing confidence reasons, signal evidence, profile evidence, and case-file exports.</figcaption>
</figure>

### History

Every finished scan is persisted to `~/.cache/adler/scans/` (oldest 200,
atomic writes). Reopen any past scan via `#/scan/<id>` deep-links.

<figure>
  <img
    src="/screenshots/03-history-modal.webp"
    alt="Adler Web UI history modal listing previous scans with usernames, summaries, and relative timestamps."
    loading="lazy"
    decoding="async"
  />
  <figcaption>History modal for reopening or comparing persisted scans.</figcaption>
</figure>

### Compare with previous

Pick any two persisted scans and diff them side-by-side (`#/diff/<a>/<b>`);
shows accounts gained / lost / flipped between the two runs. Esc /
back-button exits.

The scan header's **Compare with previous** button
<span class="since-chip">since v0.11.4</span> opens a picker listing
every other finished scan of the same username, newest first. The
first row is labelled *Most recent* and autofocused, so pressing
Enter keeps the old auto-pick-newest default for the common case;
clicking any other row diffs against that specific historical scan.
Each row shows the relative timestamp ("3h ago"), found/total/elapsed
metadata, and the absolute timestamp on the right.

<figure>
  <img
    src="/screenshots/04-diff-view.webp"
    alt="Adler Web UI diff view showing added accounts, verdict changes, and evidence changes between two scans."
    loading="lazy"
    decoding="async"
  />
  <figcaption>Diff view for added accounts, verdict flips, and evidence changes.</figcaption>
</figure>

### Filters & sort

By verdict, category, presence of evidence, hidden NotFound rows. Preferences
persist to `localStorage`.

### Identity clusters and report export

Finished scans can include compact identity-cluster cards above the
result list. A cluster groups Found profiles only when deterministic
structured evidence overlaps — shared external links, display names,
bio phrases, locations, avatar URLs, avatar hashes, or historical
co-occurrence. Username-only matches do not create clusters. Cards show
the cluster id, confidence, `uncertain` badge when the link is tentative,
reasons, and member profile URLs.

The finished scan view also exposes report downloads:

- JSON — direct `InvestigationReport` model for downstream tools.
- Markdown — text report for notes / tickets.
- HTML — self-contained local case file, no JavaScript and no external
  avatar/image loads.

See [Investigation reports](/investigation-reports/) for the shared
CLI/Web/MCP report model and privacy notes.

### Mid-scan refilter <span class="since-chip">since v0.11.5</span>

The Advanced filters modal stays editable while a scan is running.
When the filter you've edited differs from what the scan was launched
with, an **Apply (re-scan)** button replaces Done. Clicking it cancels
the in-flight scan server-side and starts a successor driven by the
new filter — sites both filters share carry over without re-probing,
so the operator pays only for newly-in-scope sites. Behind the
scenes: `POST /api/scan/:id/refilter` with the same shape as
`POST /api/scan` minus `username`, returns the new `scan_id` plus a
`carried_outcomes` count, the SPA closes the predecessor SSE stream
and opens one against the successor. Refilter requires a *running*
scan: finished scans return 400 `scan_finished` — for those, just
start a fresh scan instead.

### NSFW gate

Off by default; the toggle is hidden behind a confirmation, matching the
CLI's `--nsfw` opt-in.

### Access engine view <span class="since-chip">since v0.11</span>

The shield icon in the top bar opens a read-only panel showing what's
loaded from `--proxy-pool` (name, country, kind per egress — *never*
proxy URLs) and `--sessions` (names only, never header values).
Sensitive material is kept off the HTTP API by design; editing happens
by updating the TOML files and restarting the server.

<figure>
  <img
    src="/screenshots/05-access-modal.webp"
    alt="Adler Web UI access engine modal showing egress countries, egress kinds, and session names without proxy URLs or secret values."
    loading="lazy"
    decoding="async"
  />
  <figcaption>Access engine modal exposes only non-secret routing and session metadata.</figcaption>
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
| `GET`  | `/api/scan/:id/report?format=json\|markdown\|html` | Case-level investigation report for a finished scan. |
| `POST` | `/api/scan/:id/retry` | Re-probe a single site. |
| `POST` | `/api/scan/:id/refilter` | Cancel running scan, replace with successor under a new filter (since v0.11.5). |

SSE consumers should subscribe to the `/stream` endpoint and treat each
event as one outcome.

Finished `GET /api/scan/:id` responses include `identity_clusters` when
structured profile evidence supports a deterministic cluster. Running
snapshots and per-outcome SSE events stay outcome-shaped; clusters are
finished-scan data.

### Report endpoint — `GET /api/scan/:id/report`

`format=json` (default) returns the direct `InvestigationReport` JSON
model. `format=markdown` returns `text/markdown; charset=utf-8`.
`format=html` returns `text/html; charset=utf-8`.

Error cases:
- `404 scan_not_found` — unknown `id`.
- `400 scan_not_finished` — report generation is finished-scan only.
- `400 invalid_report_format` — format is not `json`, `markdown`, or
  `html`.

Reports are derived at read time. Persisted scans can receive historical
confidence overlays and rebuilt clusters in the response, but the stored
JSON artifact is not rewritten. For examples across CLI, Web API, and
MCP, see [Investigation reports](/investigation-reports/).

### Mid-scan refilter — `POST /api/scan/:id/refilter`

Body shape mirrors `POST /api/scan` minus `username` (carried over from
the existing scan). The server cancels the in-flight scan, computes
the overlap between old and new site lists, pre-populates the
successor's outcome buffer with overlapping outcomes, and starts a
fresh task that only probes the not-yet-done sites. Response:

```json
{
  "scan_id": "<new id>",
  "derived_from": "<old id>",
  "carried_outcomes": 142,
  "site_count": 188
}
```

Error cases:
- `404 scan_not_found` — unknown `id`.
- `400 scan_finished` — predecessor already completed; start a fresh
  `POST /api/scan` instead of refiltering.
- `400 empty_site_filter` — new filter resolves to zero sites.
- `400 unknown_egress` — `egress_names` references a name not in the
  loaded pool (validated before the cancel, so the predecessor survives
  a typo).

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
