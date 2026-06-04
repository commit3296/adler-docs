---
title: Usage
description: Common CLI flags grouped by intent — filtering, output, network, browser, cache, batch, and enrichment.
---

<p class="audience-badge audience-operator">For operators · running scans</p>
<span class="type-chip type-reference">Reference</span>

`adler <username>` scans the embedded registry; everything else is a
knob. Text output shows Found and Uncertain rows by default and hides
NotFound — pass `--all` for the full list. Results stream into a terminal
as they resolve; piped output is collected and ordered. For a browser
view, pass `--web` (see [Web UI](/web-ui/)).

Exit codes: `0` something found, `1` nothing found, `2` error.

`adler --help` has the complete flag reference; the buckets below cover
the common ones by intent.

## Filtering

```bash
adler --only github,gitlab alice         # restrict to matching site names
adler --exclude reddit alice             # drop matching site names
adler --tag social,dev alice             # filter by tag(s)
adler --tag region:ru alice              # by region tag
adler --exclude-tag bot-protected alice  # skip login-walled sites
adler --list-sites --only git            # discover filter terms (no scan)
adler --list-tags                        # show all tags + counts
```

## Output

```bash
adler --format json alice > out.json     # JSON array
adler --format ndjson alice              # one JSON object per line (jq-friendly)
adler --format csv alice > out.csv       # spreadsheet table
adler --format html alice > out.html     # self-contained HTML report
adler --all alice                        # include NotFound rows
adler -q alice                           # quiet: only Found URLs
adler --explain alice                    # show which signal produced each verdict
adler --color never alice                # disable colors (also honors NO_COLOR)
```

## Network & sessions

```bash
adler --concurrency 64 alice             # in-flight probes (default 32)
adler --max-rps 5 alice                  # cap total request rate
adler --proxy socks5://host:1080 alice   # single proxy for everything
adler --proxy-pool pool.toml alice       # per-site geo/IP-type routing
adler --sessions sessions.toml alice     # operator-supplied sessions
adler --tor alice                        # local Tor SOCKS proxy
adler --rotate-ua alice                  # rotate User-Agent per request
```

See [Access engine → Egress pool](/access-engine/#egress-pool-geo-routing)
for how `--proxy-pool` interacts with the registry's per-site `access`
policies, and [Access engine →
Sessions](/access-engine/#sessions-reach-login-walled-sites)
for the session TOML format.

For TLS-fingerprint-blocked sites, build with `--features impersonate`
(see [Access engine → TLS-fingerprint
impersonation](/access-engine/#tls-fingerprint-impersonation)).

## Browser & cache

```bash
adler --browser-backend local alice          # headless Chrome for bot-protected
adler --browser-backend browserbase alice    # Browserbase cloud session
adler --browser-budget 20 alice              # cap browser-routed probes (default 50)
adler --no-browser alice                     # off for this run

adler --escalation-budget 50 alice           # automatic escalation cap (default 30)
adler --no-escalation alice                  # cheap-path verdicts only

adler --no-cache alice                       # bypass the result cache
adler --cache-ttl 86400 alice                # custom TTL (default 3600 s)
adler --cache-clear                          # drop the cache
```

Cache lives at `~/.cache/adler/`. The browser backend and automatic
escalation are described in [Access engine → Browser backend](/access-engine/#browser-backend)
and [Access engine → Automatic escalation](/access-engine/#automatic-escalation).

## Batch & enrichment

```bash
adler --input users.txt                      # batch many usernames, grouped output
adler --watch alice                          # diff vs last run; new/removed
adler --watch --interval 3600 alice          # keep watching
adler --enrich alice                         # extract name/bio/avatar
adler --correlate alice                      # group accounts by signal overlap
adler --permute aggressive alice             # search spelling variants
adler --completions zsh > _adler             # shell completions
```

## Doctor

The registry's detection signals occasionally rot — a site changes its
response markup, or its known-present test account gets deleted. The
doctor probes both halves of every signal (a known-present user must
resolve to `Found`, a random nonsense user must not) and reports any
site whose detection no longer holds.

```bash
adler --doctor                              # check every site
adler --doctor --only github,gitlab         # subset
adler --doctor --fix --only patreon         # propose a corrected signature
adler --doctor --suggest-known-present      # find candidate users for stale entries
adler --doctor --suggest-extract            # derive extract blocks from OpenGraph; since v0.14
adler --doctor --fix --apply --sites overrides.json --yes  # patch signals in place; since v0.12
adler --doctor --suggest-known-present --apply --sites overrides.json --yes  # patch known_present in place; since v0.14
adler --doctor --suggest-extract --apply --sites overrides.json --yes  # patch extract blocks in place; since v0.14
adler --doctor --suggest-protection         # cross-scan telemetry; since v0.13
adler --doctor --format ndjson              # structured output (json|ndjson); since v0.14
```

`--doctor --fix` diffs the present/absent responses and prints a paste-
ready signal you can drop into the registry (or a local override). A
nightly GitHub Action runs the doctor across the whole registry and flags
structural rot.

`--format json` / `--format ndjson` <span class="since-chip">since v0.14</span> emits
structured output instead of the human-readable `[OK]` / `[FAIL]` lines.
`json` produces a single envelope `{"sites":[…],"summary":{…}}` (pretty-
printed); `ndjson` streams one record per line plus a final tagged
`{"type":"summary",…}` line, ideal for piping through `jq` or feeding
into `scripts/doctor_aggregate.py` (which auto-detects either format).
Each per-site record is `{"name":<str>,"verdict":"healthy"|"unhealthy",
"issues":[<str>]}`. The `--format csv` and `--format html` modes from
the scan path don't fit the doctor's shape and are rejected with an
actionable error.

`--apply` <span class="since-chip">since v0.12</span> closes the
doctor → suggestion → patch loop in three flavours:

- **With `--fix`** — walks the JSON via `--sites`, replaces the
  matching entry's `signals` array with the diffed suggestion, and
  writes back through a sibling `*.tmp` so a crash mid-write leaves
  the original intact.
- **With `--suggest-known-present`** <span class="since-chip">since v0.14</span> —
  discovers a fresh `known_present` candidate for each failing site
  (probes a small pool of well-known usernames) and writes the
  discovered value into the entry's `known_present` field. Same
  atomic-rename pattern.
- **With `--suggest-extract`** <span class="since-chip">since v0.14</span> —
  walks every *healthy* site that doesn't yet declare any `extract`
  rules, fetches the `known_present` profile page, and mines
  `OpenGraph` (`og:title` / `og:description` / `og:image`) and
  Twitter Card meta tags to derive a candidate `extract` block. The
  derived rules read each tag's `content` attribute, so they survive
  unrelated CSS churn as long as the meta block itself stays put.
  Sites with an existing `extract` array are skipped so hand-authored
  selectors aren't clobbered.

Every flavour prints a per-site `- old + new` diff and prompts once
for confirmation; `--yes` skips the prompt for CI batch repair.
Sites with no suggestion are skipped, names absent from the JSON file
are reported and skipped (never erased), and `--apply` requires
`--sites <writable>` because the embedded registry isn't patchable in
place. A bare `--apply --sites …` without any of `--fix`,
`--suggest-known-present`, or `--suggest-extract` errors out —
`--apply` is the verb, the other flag is the noun.

`--suggest-protection` <span class="since-chip">since v0.13</span>
reads the persisted scan history (default
`$XDG_CACHE_HOME/adler/scans/`, override with `--scans-dir`) and
surfaces sites that consistently escalated through the browser
backend. These are candidates for adding `protection: cloudflare`
to `sites.json` so future scans skip the failing HTTP probe and pick
the right transport up front. Pure suggestion path — never auto-
modifies, same convention as `--suggest-known-present`. Output is a
paste-ready table plus a `PROTECTION additions:` block.

## MCP server <span class="since-chip">since v0.15</span>

```bash
adler --mcp                                       # stdio (Claude Desktop / Cursor / local agents)
adler --mcp-http 127.0.0.1:8766                   # HTTP+SSE, endpoint http://127.0.0.1:8766/mcp
```

Adler ships a [Model Context Protocol](https://modelcontextprotocol.io/)
server (`adler-mcp` crate, default-on) that exposes the OSINT surface
to AI agents. Same tool / resource / prompt set regardless of
transport — pick stdio when the agent spawns Adler as a subprocess
(Claude Desktop, Cursor); pick HTTP+SSE when the agent runs out-of-
process or on a different host.

**Tools** (callable agent actions):

- `list_sites` — browse the enabled registry; filter by `tag` /
  `exclude_tag` / `include_nsfw`.
- `scan_username` — single-username scan; streams per-site progress
  as MCP `notifications/progress` when the client supplies a
  `progressToken`.
- `scan_batch` — sequential multi-username scan; same shared
  `ScanFilter` shape as `scan_username`.
- `doctor_check` — health probe one named site; useful for triaging
  "why didn't this site come back Found?".
- `get_scan_history` — recent persisted scans from
  `$XDG_CACHE_HOME/adler/scans/` (where `adler --web` writes).

**Resources** (browsable data):

- `adler://registry/sites` — every enabled site (compact: name, URL
  template, tags, popularity).
- `adler://registry/tags` — every tag with its enabled-site count.
- `adler://registry/disabled` — disabled entries with their
  `disabled_reason` annotations (audit surface).
- `adler://scans/recent` — recent persisted scan summaries.
- `adler://scans/{id}` — full envelope for one scan (template).

**Prompts** (templated OSINT workflows the agent can `prompts/get`):

- `investigate_username(username, regions?, categories?)` — full
  OSINT walk for one identity.
- `audit_registry_health(focus?)` — doctor + dedup + disabled audit
  with a built-in ~5-site doctor budget.
- `correlate_accounts(usernames)` — scan a list and look for shared
  profile signal (Strong / Plausible / Weak / Distinct rubric).

**Security defaults.** The HTTP transport binds loopback by default
and inherits rmcp's `allowed_hosts` filter (`localhost`, `127.0.0.1`,
`::1`) as a DNS-rebind guard. Binding a non-loopback address exposes
the API without authentication — only do it on a trusted network.
Stdio carries no network surface and is the recommended transport
for desktop integrations.

**Ethical line.** The MCP `instructions` block sent to the agent on
`initialize` restates the project's bound: authorised security
testing / OSINT research / defensive work only; no harassment /
doxxing / unauthorised surveillance. The `investigate_username`
prompt repeats this in its body for context.

## When things go wrong

Real shapes for the most common failure modes — copy-and-paste examples
of what each error looks like so you can match a pattern in your own
output without guessing.

### Unknown egress name from `POST /api/scan` <span class="since-chip">since v0.11</span>

When the SPA's Advanced filters → Egress section sends an `egress_names`
entry that's not in the loaded pool, the API rejects at the boundary
rather than silently dropping to "no egress matched":

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": "unknown_egress",
  "message": "egress not in pool: us-residential-typo"
}
```

CLI equivalent: the `--proxy-pool` TOML is read at startup, so a typo
in the file surfaces as a config error before any scan runs.

### Site policy needs an egress the pool can't supply

The site declares `access.geo = ["pl"]` (a Polish IP), the pool has
nothing tagged `pl`. The probe never goes out; the verdict carries the
reason:

```json
{
  "site": "VK",
  "kind": "uncertain",
  "reason": "geo_unavailable",
  "transport": "http",
  "escalations": 0,
  "elapsed_ms": 0
}
```

Remedy: add a Polish egress to `pool.toml`, or accept the Uncertain (a
location you can't reach is not evidence the account is absent).

### Named session missing

The site declares `access.session = "ig"` and you didn't pass
`--sessions <file>` (or the file doesn't have an `[ig]` block). Same
pattern, different reason:

```json
{
  "site": "Instagram",
  "kind": "uncertain",
  "reason": "session_required",
  "transport": "http",
  "escalations": 0,
  "elapsed_ms": 0
}
```

Remedy: copy the Instagram cookies from your browser's devtools into
`[ig]` block of `sessions.toml`.

### Deadline exceeded mid-scan

You set `--deadline-secs 30` on a 2,000-site scan and ran out of time.
Sites that didn't get their turn surface with:

```json
{
  "site": "Wattpad",
  "kind": "uncertain",
  "reason": "deadline",
  "elapsed_ms": 0
}
```

Remedy: narrow with `--tag` / `--only`, raise `--deadline-secs`, or
raise `--concurrency`.

### Browser budget exhausted

`--browser-budget 5` set, more than five `bot-protected` sites in the
scope:

```json
{
  "site": "Threads",
  "kind": "uncertain",
  "reason": "browser_budget",
  "elapsed_ms": 0
}
```

The first five `bot-protected` sites went through the browser
successfully; the rest fall back to this honest Uncertain rather than
silently dropping out of the scan. Remedy: raise `--browser-budget` or
`--exclude-tag bot-protected` to skip the subset entirely.
