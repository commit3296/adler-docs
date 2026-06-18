# Screenshots maintenance

The Web UI docs page uses five WebP screenshots from
`public/screenshots/`. Keep the filenames stable so links in
`src/content/docs/web-ui.md` keep resolving:

- `01-live-scan.webp` — running scan view.
- `02-result-row-detail.webp` — expanded result row with confidence,
  transport, evidence, identity clusters, and report export controls.
- `03-history-modal.webp` — persisted scan history modal.
- `04-diff-view.webp` — scan diff view.
- `05-access-modal.webp` — access engine modal with non-secret metadata.

The current images were captured from the local Adler Web UI with
deterministic mocked API data. That is intentional: docs screenshots
should not depend on live sites, operator sessions, proxy pools, or
external network timing.

Do not add new `<img src="/screenshots/...">` references before the files
exist in `public/screenshots/` — that creates broken production images
and fails lychee.

## Setup

1. Build a fresh Web UI:
   ```bash
   npm --prefix ../repo/adler-server/web run build
   ```
2. Run either the real server or a local preview with deterministic API
   mocks. Real-server captures need a non-trivial config so the Access
   modal has something to show:
   ```bash
   adler --web \
       --proxy-pool ~/.config/adler/pool.toml \
       --sessions ~/.config/adler/sessions.toml \
       --browser-backend local
   ```
   If you don't have a pool / sessions file handy, copy the examples
   from `/access-engine/#egress-pool-geo-routing` and
   `/access-engine/#sessions-reach-login-walled-sites`.
3. Open `http://127.0.0.1:8080/` in your browser, or use Playwright
   against `vite preview` when refreshing mocked screenshots.

## Capture settings

- **Viewport**: `1280 × 800`. The SPA layout settles cleanly at this
  size — wider and the right-side gutter dominates; narrower and the
  sidebar wraps.
- **DPR / scale**: `2x` (Retina-quality) if your tool supports it; the
  Starlight `<img>` tag below uses `srcset` to halve display size.
- **Format**: `webp`, quality ~85. Matches the rest of the docs site
  asset pipeline.
- **Naming**: see filenames below; use these exact names so the page
  references resolve.
- **Where to drop them**: `public/screenshots/`. The docs site serves
  `public/` at root, so the files end up at
  `https://adler-docs.pages.dev/screenshots/<name>.webp`.

## Frames

### 1. `01-live-scan.webp` — running scan view

> A scan in progress, mid-stream, with the live SSE outcomes painting
> the categorised result list. This is the canonical "Adler in action"
> shot.

- Enter a real username with broad coverage (e.g. `blue` or `torvalds`)
  into the search box.
- Press Enter.
- Capture **while the spinner is still going**, when roughly 30–60%
  of rows have arrived. Visible Found / Uncertain rows in a couple of
  category groups (dev, social, …) is the look.

### 2. `02-result-row-detail.webp` — result row with evidence

> A close-up of one or two `ResultRow`s with the `transport` chip
> visible — proves the v0.10 telemetry exists and shows what `browser*`
> looks like (the escalated case).

- Run a scan against a username that hits a Cloudflare-walled site
  (`blue` or any username on Reddit / Patreon usually triggers it).
- Wait for the scan to finish so escalations have settled.
- Scroll to a row where the `transport` chip reads `browser*` (small
  red-orange chip in the meta column).
- Capture the row plus nearby context. Prefer a frame that also shows
  report export controls and identity clusters when possible.

### 3. `03-history-modal.webp` — History drawer

> The right-side drawer listing recent scans. Establishes that scans
> persist and previous runs are reachable.

- Run two or three scans against different usernames so the drawer
  has at least 3–5 entries.
- Click the **History** (clock) icon in the top bar.
- Capture the open drawer with the modal-backdrop dimming the rest.

### 4. `04-diff-view.webp` — Side-by-side scan diff

> The compare-with-previous view. Hardest to set up — requires two
> scans of the same username spaced out.

- Run `adler --web` with persistence enabled (default is
  `~/.cache/adler/scans/`).
- Scan one username (`torvalds`).
- Modify some accounts (or wait until something changes) — easier:
  scan a username where one site flips Uncertain → Found or
  Found → NotFound (e.g. after enabling `--browser-backend`).
- In the History drawer, arm the first scan as "compare from", then
  click "diff" on the second scan.
- Capture the side-by-side view at `#/diff/<a>/<b>` with at least one
  row in each of Added / Removed / Flipped.

### 5. `05-access-modal.webp` — Access engine read-only modal

> The shield icon's modal showing the loaded `--proxy-pool` (name,
> country, kind — never URLs) and `--sessions` (names only). Proves
> the v0.11 access view and the no-secrets-on-the-wire design.

- Boot the server with `--proxy-pool` + `--sessions` (per setup above).
- Click the **shield** icon in the top bar.
- Capture the modal open.

## After refresh

Once the files are updated in `public/screenshots/`:

1. Confirm `src/content/docs/web-ui.md` still references the intended
   files.
2. Run `npm run build`.
3. Commit + push.
4. CF Pages rebuilds; `adler-docs.pages.dev/web-ui/` renders the
   images inline.
5. If a path mismatch makes one 404, the `<img>` tag's `alt` text falls
   back gracefully — not blocking, but worth fixing.
