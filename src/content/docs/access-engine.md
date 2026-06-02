---
title: Access engine
description: How Adler reaches sites that block plain HTTP — browser backend, TLS-fingerprint impersonation, per-site egress pool, operator-supplied sessions, and automatic escalation.
---

<p class="audience-badge audience-operator">For operators · running scans</p>
<span class="type-chip type-explanation">Explanation</span>

<aside class="tldr">

Five primitives that convert `Uncertain` into real verdicts:

- **Browser backend** — local Chrome / Browserbase for `bot-protected` sites.
- **Automatic escalation** — retry through the browser on `cloudflare_challenge` / `rate_limited`.
- **Egress pool** — TOML of per-country proxies for sites with geo-restricted `access` policies.
- **Sessions** — operator-supplied logged-in headers for login-walled sites.
- **TLS-fingerprint impersonation** — Chrome 134 BoringSSL handshake via the `impersonate` feature.

Each `CheckOutcome` stamps `transport` and `escalations` so you can see which path produced the verdict.

</aside>

The access engine is the cluster of routing primitives that lets Adler
reach sites a plain HTTP client can't see. Together they're how Adler
flips an honest `Uncertain(reason)` into a real `Found` / `NotFound` on
the hard subset of the registry — Cloudflare-walled, TLS-fingerprinted,
geo-restricted, login-walled.

## The route a probe takes

Every probe walks the same decision tree. Pre-flight checks fire first
(username regex, session resolution); then the router picks a primary
transport based on the site's `protection` tags; an `Uncertain` reason
that a browser could resolve triggers automatic escalation; an
operator-policy `Uncertain` (geo / session / robots / etc.) is kept as-is.

<pre class="mermaid">
flowchart TD
    Start([Probe a site]) --> Regex{regex_check<br/>matches?}
    Regex -->|No| UnameU[Uncertain<br/>username_not_allowed]
    Regex -->|Yes| Session{access.session<br/>named?}
    Session -->|Yes, missing| SessU[Uncertain<br/>session_required]
    Session -->|None or supplied| Bot{tagged<br/>bot-protected?}
    Bot -->|Yes, browser ok| BrowserPath[Browser fetch]
    Bot -->|Yes, no browser| AlwaysU[Uncertain<br/>always]
    Bot -->|No| TLS{protection<br/>= tls-fingerprint?}
    TLS -->|Yes + impersonate built| ImpPath[Impersonate fetch<br/>wreq + Chrome 134]
    TLS -->|No| Egress{access policy<br/>satisfied by pool?}
    Egress -->|No matching egress| GeoU[Uncertain<br/>geo_unavailable]
    Egress -->|Yes| HttpPath[HTTP fetch<br/>through chosen egress]
    HttpPath --> Verdict{Verdict?}
    ImpPath --> Verdict
    BrowserPath --> Final([Verdict])
    Verdict -->|Found / NotFound| Final
    Verdict -->|Uncertain CF / 429| Esc{escalation<br/>budget left?}
    Verdict -->|Other Uncertain| Final
    Esc -->|No| Final
    Esc -->|Yes, browser ok| EscFetch[Escalated browser fetch]
    EscFetch --> Final
</pre>

The primitives the tree refers to are documented per-section below.

When the cheap transport returns an `Uncertain` reason a browser would
resolve (Cloudflare interstitial, 429-style rate-limit), the router
**automatically escalates** to the browser backend if one is configured
— bounded by a separate `--escalation-budget`.

Every outcome carries `transport` and `escalations` telemetry so the
operator can see which path produced each verdict.

## Browser backend

A small subset of sites — currently **Instagram and Twitter**
(`adler --list-tags` shows the live count; the tag is kept narrow because
every additional candidate either detects fine without a browser or is
structurally unscrapable even *with* one) — serve a JavaScript login wall
or a Cloudflare challenge to a plain HTTP request. They're tagged
`bot-protected` and on the raw HTTP path will *always* return `Uncertain`
because the response looks identical for an existing account and a
missing one.

With `--browser-backend` Adler routes those sites (and *only* those —
everything else stays on the fast HTTP path) through a real headless
Chrome that runs JS, accepts cookies, and returns the final post-render
DOM. The same detection signals then apply, and a verdict becomes
possible.

### Backends

Two backends are supported, picked at the CLI:

| Flag | What it does | Cost | Requirements |
|---|---|---|---|
| `--browser-backend local` | Launches headless Chrome on your machine via [`chromiumoxide`](https://crates.io/crates/chromiumoxide) | Free | Chrome / Chromium installed locally |
| `--browser-backend browserbase` | Opens a remote session on [Browserbase](https://browserbase.com) and connects over the CDP WebSocket | Pay per session-minute (≈ $0.05 / min) | `ADLER_BROWSERBASE_API_KEY` and `ADLER_BROWSERBASE_PROJECT_ID` env vars. Drives CDP through a small in-tree async client (`adler-core/src/browser/cdp.rs`) — neither `chromiumoxide` nor `headless_chrome` could attach to Browserbase's remote browser cleanly (issue #5), so we wrote our own. |

Both reuse a single browser instance across all routed fetches for the
scan, so cost / setup overhead is one-time.

### Examples

```bash
# Local Chrome — pairs cleanly with --proxy (passed through as
# --proxy-server to the child process).
adler --browser-backend local --proxy socks5h://USER:PASS@HOST:PORT alice

# Cloud session with residential / mobile IP and anti-fingerprint baked in.
export ADLER_BROWSERBASE_API_KEY=bb_live_...
export ADLER_BROWSERBASE_PROJECT_ID=...
adler --browser-backend browserbase alice

# Cap browser-routed probes (default 50). Once exceeded, remaining
# bot-protected sites return Uncertain(browser_budget_exceeded).
adler --browser-backend browserbase --browser-budget 10 alice

# Disable for one run even if the env / a shell alias has it on.
adler --no-browser alice
```

### Guardrails

- **Per-scan budget** — `--browser-budget N` caps how many browser
  fetches a single scan may consume. Default is 50, ≈ 5× the
  `bot-protected` subset of the registry, so the cap only ever fires if
  a flag is misconfigured.
- **No surprise routing** — only sites tagged `bot-protected` are sent
  through the browser. Everything else is unaffected. Use
  `adler --list-tags` to see what's tagged.
- **Privacy** — the `browserbase` backend sends the URLs you scan to a
  third-party US-based service. The `local` backend doesn't leave your
  machine (modulo whatever proxy you've configured Chrome to use).

### Trade-offs vs. raw HTTP

Browser fetches are inherently 5–10× slower than raw HTTP and (for
`browserbase`) cost real money. They're the only way to detect accounts
on the bot-protected subset, but on the rest of the registry they'd add
latency for no recall gain — which is why routing is opt-in and
tag-driven, not blanket.

## Automatic escalation <span class="since-chip">since v0.10</span>

The pre-tag routing above handles sites the registry has *already* marked
as `bot-protected`. It can't help with the long tail — sites that look
like a normal HTTP target until the moment they sit behind a Cloudflare
edge or a 429 rate-limit and return an interstitial page. Without help,
those sites land in `Uncertain(cloudflare_challenge | rate_limited)` on
every scan from the cheap path.

When a browser backend is configured, Adler watches for those
escalation-worthy `Uncertain` reasons on the cheap path and automatically
retries through the browser — flipping the verdict from `Uncertain` to
`Found` / `NotFound` without the operator having to pre-tag the site.
Each retry consumes one slot of a separate `--escalation-budget` (default
`30`), so a Cloudflare-walled long tail doesn't quietly blow up your
Browserbase bill.

```bash
adler --browser-backend local alice                 # escalation on, default budget 30
adler --browser-backend local --escalation-budget 50 alice
adler --browser-backend local --no-escalation alice  # cheap-path verdicts only
```

Outcomes carry a `transport` field (`http` / `impersonate` / `browser`)
and an `escalations` count (0 in the happy path, 1 when escalation fired)
so downstream tools can tell which path produced each verdict. Sites
that never escalate stay on the cheap, fast HTTP path; only the ones
that hit a wall pay the browser-fetch cost.

Escalation only triggers on reasons a browser plausibly resolves —
`CloudflareChallenge` and `RateLimited`. Operator-policy `Uncertain`s
(`robots_disallowed`, `session_required`, `geo_unavailable`,
`username_not_allowed`, deadline / scheduler / captcha) are kept as-is so
escalation doesn't waste budget on hopeless cases.

## Egress pool (geo routing)

Some sites only answer from a particular country, or block datacenter IP
ranges. A site can declare what egress it needs via its `access` policy
in the registry (a country and/or an IP type); `--proxy-pool` supplies
the proxies that satisfy those requirements.

`--proxy` still routes *everything* through one proxy (the default
egress). `--proxy-pool` is additive and **only** kicks in for sites
whose `access` policy requires a specific egress — everything else keeps
using the default. If a site needs an egress the pool can't provide,
it's reported `Uncertain(geo_unavailable)` rather than fetched from the
wrong place — a location you can't reach is not evidence the account is
absent.

The pool is a TOML file of `[[egress]]` entries:

```toml
# pool.toml
[[egress]]
name = "pl-residential"  # optional; needed for per-scan subset selection in --web
url = "socks5://user:pass@pl.example.com:1080"
country = "pl"           # ISO-3166-1 alpha-2 (lowercased)
kind = "residential"     # datacenter (default) | residential | mobile | tor

[[egress]]
name = "de-datacenter"
url = "http://de.example.com:8080"
country = "de"
# kind omitted → datacenter
```

```bash
adler --proxy-pool pool.toml alice
```

Bring your own proxies — Adler ships the routing, not the egress. The
browser backend keeps its own egress (e.g. Browserbase's residential
IPs); `--proxy-pool` routes the raw-HTTP path.

When `adler --web` is running, the SPA can [restrict a single scan to a
subset of the pool by name](/web-ui/#per-scan-egress-subset) <span class="since-chip">since v0.11</span>,
without re-launching the server.

## Sessions (reach login-walled sites) <span class="since-chip">since v0.10</span>

Some sites only show a profile to a logged-in user (Instagram, Threads,
Reddit's JSON). A site can declare `access.session = "<name>"` in the
registry; `--sessions <file>` supplies that named session's headers —
your own (or a sock-puppet) account's — applied to the site's probe so
it sees a real session instead of a login wall.

This is "use a real account", not evasion: Adler doesn't solve challenges
or forge anything; you bring a session you're entitled to. If a site
names a session you didn't supply, it's reported
`Uncertain(session_required)` rather than a login-wall false negative.

The file is TOML; each `[name]` table is a set of HTTP headers (copy them
from your browser's devtools):

```toml
# sessions.toml
[ig]
Cookie = "sessionid=...; csrftoken=..."
X-IG-App-ID = "936619743392459"

[reddit]
Cookie = "reddit_session=..."
```

```bash
adler --sessions sessions.toml alice
```

Header values are secrets — redacted from logs, never written to scan
output. Using a sock-puppet account may breach a site's ToS; that's an
operator decision within your engagement's scope.

## TLS-fingerprint impersonation <span class="since-chip">since v0.10</span>

Some sites read the TLS handshake's JA3 / JA4 fingerprint and serve a
block page to anything that doesn't look like a real browser — `rustls`
or `reqwest`'s default fingerprints are well-known and easy to filter.
Sites tagged `protection: tls-fingerprint` in the registry declare this.

Build Adler with the `impersonate` feature to enable an in-process `wreq`
HTTP client emulating Chrome 134 (BoringSSL handshake matches real
Chrome's JA3 / JA4 / HTTP-2 fingerprint). Sites whose protection is
*only* TLS fingerprint then route through it — much cheaper than spinning
up a real browser:

```bash
cargo install adler-cli --features impersonate
```

The feature pulls in BoringSSL and needs `cmake`, a C++ compiler, and
`libclang` at build time:

- Fedora: `sudo dnf install cmake gcc-c++ clang`
- Debian / Ubuntu: `sudo apt install cmake clang libclang-dev`

`cargo binstall adler-cli` ships impersonate-enabled binaries for
x86_64-linux, both macOS targets, and Windows. The
`aarch64-unknown-linux-gnu` binary is built without the feature
(cross-compiled BoringSSL toolchain isn't wired up), so on aarch64 Linux
use `cargo install adler-cli --features impersonate` instead.

Sites with mixed protections (e.g. `tls-fingerprint` + `cloudflare`)
stay on the browser-backend path — impersonate alone won't get past
Cloudflare's JS challenge.

## Telemetry: `transport` and `escalations` on outcomes

Every outcome stamps which transport actually produced its verdict, so
downstream tools (the doctor, the bench harness, the web UI, your own
JSON consumers) can tell the difference between a `Found` that came back
from raw HTTP and a `Found` that required a browser fetch.

<pre class="mermaid">
sequenceDiagram
    participant R as Router
    participant H as HTTP
    participant B as Browser backend
    participant O as CheckOutcome
    participant U as Consumer<br/>(SPA / JSON / bench)
    Note over R: Cheap transport first
    R->>H: fetch(site, headers)
    H-->>R: response
    alt Found / NotFound
        R->>O: stamp transport=http, escalations=0
    else Uncertain(cloudflare / 429)
        Note over R: Escalation budget ok?
        R->>B: retry via browser
        B-->>R: response
        R->>O: stamp transport=browser, escalations=1
    else Other Uncertain
        R->>O: stamp transport=http, reason
    end
    O-->>U: outcome with telemetry
</pre>

Two concrete shapes:

```json
{
  "site": "GitHub",
  "kind": "found",
  "transport": "http",
  "escalations": 0,
  "elapsed_ms": 124
}
```

```json
{
  "site": "Patreon",
  "kind": "found",
  "transport": "browser",
  "escalations": 1,
  "reason": null,
  "elapsed_ms": 980
}
```

In the second example, the cheap path returned
`Uncertain(cloudflare_challenge)` and the router escalated to the browser
backend; one escalation budget slot was consumed. Tools surfacing the
field include the web UI (a small `transport` chip on each
[`ResultRow`](/web-ui/#result-rows)), `adler --explain`, and
the JSON / NDJSON output formats.
