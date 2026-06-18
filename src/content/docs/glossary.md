---
title: Glossary
description: Adler-specific terminology, in one place. Use the alphabetical index to jump to a definition.
---

<p class="audience-badge audience-operator">For operators · scanning</p>
<p class="audience-badge audience-embedder">For embedders · Rust</p>
<p class="audience-badge audience-contributor">For contributors · registry</p>
<span class="type-chip type-reference">Reference</span>

Single source of truth for Adler-specific terminology. Definitions here
override any informal usage you might see in commit messages, PR
descriptions, or chat — when the docs disagree with chat, the docs are
right.

## A

### Access policy

A site-level declaration of what the probe path needs: a country, an IP
type (`datacenter` / `residential` / `mobile` / `tor`), and / or a named
session. Encoded as `access.geo`, `access.ip_type`, and `access.session`
in `sites.json`. Unconstrained policies (the common case) route through
the [default egress](#default-egress); constrained ones go through the
[egress pool](#egress-pool).

### Avatar hash

Opt-in perceptual hash evidence derived from an extracted avatar URL.
The CLI fetches the image only when `--avatar-hash` is set, enforces
size / content-type / timeout bounds, and stores a versioned string such
as `dhash64_v1:...`. Raw image bytes are never persisted. Avatar hash
matches are supporting [identity-cluster](#identity-cluster) evidence,
not standalone identity proof.

## B

### Bot-protected

A registry tag (`bot-protected`) declaring that a site serves a JavaScript
login wall or a Cloudflare challenge to plain HTTP requests, so its
response is identical for an existing account and a missing one.
Bot-protected sites are routed through the [browser
backend](/access-engine/#browser-backend) when one is configured;
without it they always return [`Uncertain`](#uncertain).

### Browser backend

A real headless Chrome (`--browser-backend local`) or a Browserbase
cloud session (`--browser-backend browserbase`) that runs JS, accepts
cookies, and returns the final post-render DOM. The same detection
signals then apply, so [bot-protected](#bot-protected) sites become
verdict-able. Bounded by [browser budget](#browser-budget).

### Browser budget

Per-scan cap on browser-routed fetches (`--browser-budget N`, default
`50`). Independent of [escalation budget](#escalation-budget): a
pre-tagged [bot-protected](#bot-protected) site consumes browser
budget; a non-pre-tagged site that escalates from HTTP to browser
consumes one of each.

## C

### Confidence

Explainable per-outcome trust score (`0`–`100`) with a coarse label
(`low`, `medium`, `high`) and machine-readable reasons. Stored on
`CheckOutcome.confidence`, surfaced in JSON / Web / MCP / reports, and
kept conservative: authentication, exact username evidence, rich profile
metadata, successful escalation, and historical consistency can raise
confidence; session-required / blocked / weak status-only paths stay
low or capped.

## D

### Default egress

The HTTP path's "no policy, no `--proxy-pool` match" exit — either
direct or via a global `--proxy <url>`. Sites without an [access
policy](#access-policy) always use it.

### Doctor

Built-in registry health check (`adler --doctor`). Probes each site's
[known-present](#known-present) user (must resolve to
[Found](#verdict)) and a random nonsense user (must not), reporting any
site whose detection signal no longer holds. `--doctor --fix` diffs the
present / absent responses and proposes a corrected signature.

## E

### Egress

A network exit point — typically a proxy. Each [egress
spec](#egress-spec) carries match metadata (country, kind, optional
name) and the proxy URL.

### Egress pool

Operator-supplied collection of [egresses](#egress) loaded via
`--proxy-pool <file.toml>`. Sites whose [access policy](#access-policy)
declares a geo / IP-type requirement match against the pool; the rest
use the [default egress](#default-egress). A constrained policy with
no matching egress yields [`Uncertain(geo_unavailable)`](#uncertain),
not [`NotFound`](#verdict).

### Egress spec

One TOML `[[egress]]` block: a `url`, optional `country` (ISO-3166-1
alpha-2, lowercase), optional `kind`
(`datacenter` / `residential` / `mobile` / `tor` — defaults to
`datacenter`), and optional `name` (needed for per-scan subset
selection in `--web`).

### Egress subset

Per-scan filter of the loaded [egress pool](#egress-pool) by name.
Selected via `egress_names: Vec<String>` on `POST /api/scan` from the
SPA's Advanced filters modal <span class="since-chip">since v0.11</span>. Sites whose access policy can't be
satisfied by the chosen subset land in
[`Uncertain(geo_unavailable)`](#uncertain).

### Escalation

Automatic retry of an [`Uncertain`](#uncertain) outcome through a
heavier transport (typically [browser](#browser-backend)) when the
cheap path hit `cloudflare_challenge` or `rate_limited` <span class="since-chip">since v0.10</span>. Triggered only on
those two reasons — operator-policy `Uncertain`s
(`robots_disallowed`, `session_required`, `geo_unavailable`,
`username_not_allowed`, deadline / scheduler / captcha) are kept as-is
so escalation doesn't waste budget on hopeless cases.

### Escalation budget

Per-scan cap on automatic [escalations](#escalation)
(`--escalation-budget N`, default `30`). Independent of the [browser
budget](#browser-budget). `--no-escalation` disables escalation
entirely.

## I

### Impersonate

In-process [TLS-fingerprint-emulating](/access-engine/#tls-fingerprint-impersonation)
HTTP transport that performs a real BoringSSL handshake matching
Chrome 134's JA3 / JA4 fingerprint <span class="since-chip">since v0.10</span>. Built via the `impersonate`
Cargo feature; routes [TLS-fingerprint-tagged](#protection-tag) sites
through `wreq` instead of the heavier [browser
backend](#browser-backend).

### Identity cluster

Deterministic grouping of Found profile outcomes that share structured
evidence. `IdentityCluster` records members, cluster confidence,
machine-readable reasons, and an `uncertain` flag. Shared usernames
alone never merge accounts; weak matches such as avatar hash plus one
other weak signal stay tentative.

### Investigation report

Case-level model rendered from a finished scan. `InvestigationReport`
combines summary counts, found accounts, high-confidence accounts,
signal evidence, [profile evidence](#profile-evidence), [confidence](#confidence),
[identity clusters](#identity-cluster), timeline events, and
limitations. CLI, Web, and MCP all render or return this same model; see
[Investigation reports](/investigation-reports/).

## K

### Known-absent

Optional `known_absent` field on a `Site`: a username known to *not*
exist on that site. Used by [`--doctor`](#doctor) to assert the
detection signal fires `NotFound` (or [`Uncertain`](#uncertain))
correctly on a guaranteed-absent input.

### Known-present

Required `known_present` field on a `Site`: either a single username
string or a `KnownPresent::Multiple(Vec<String>)` of usernames known to
exist. [`--doctor`](#doctor) passes the site if **any** declared
username resolves to [Found](#verdict).

## M

### Multi-signal detection

Adler's detection model: the HTTP status, body markers, and redirect
behaviour are combined into one verdict — `Found` / `NotFound` /
[`Uncertain(reason)`](#uncertain) — rather than relying on a single
status check. Combines via [negative-priority
aggregation](#negative-priority-aggregation).

## N

### Negative-priority aggregation

How [signals](#signal) vote: any `NotFound` vote wins over `Found`; no
votes → [`Uncertain`](#uncertain). Optimised for fewer false positives
on sites that return `200` for every username (the common Sherlock
failure mode).

## P

### Profile evidence

Normalized observed profile facts attached to a Found outcome:
username-confirmation, display name, bio, avatar URL, avatar hash,
external link, location, joined date, profile title, meta description,
or extracted field. Source metadata records non-secret provenance such
as site, URL, origin, observed timestamp, transport, and whether
authenticated access was used.

### Protection tag

A registry-level `protection` declaration that names the specific
mechanism a site uses to block bots: `tls-fingerprint`, `cloudflare`,
`captcha`, or `user-auth`. The router infers a default transport from
this list — pure `tls-fingerprint` → [impersonate](#impersonate),
anything with `cloudflare` or mixed → [browser](#browser-backend),
`user-auth` → needs a [session](#session). Mixed protections
(e.g. `tls-fingerprint` + `cloudflare`) stay on the browser path.

## S

### Session

Operator-supplied authenticated HTTP headers (typically `Cookie`,
sometimes `Authorization` / CSRF tokens) applied to probes for sites
whose [access policy](#access-policy) names them <span class="since-chip">since v0.10</span>. Loaded from a TOML file
via `--sessions <file>`; values are redacted from logs and never
written to scan output. A named-but-missing session yields
[`Uncertain(session_required)`](#uncertain).

### Signal

One detection rule on a `Site`: `StatusFound { codes }`,
`StatusNotFound { codes }`, `BodyContains`, `BodyAbsent`,
`BodyUsername`, `RedirectLocation`, etc. A site declares one or more
signals; the verdict is the [negative-priority
aggregation](#negative-priority-aggregation) of their votes.
`BodyUsername` is the strict exact-username signal: its marker must
contain `{username}` and creates username [profile evidence](#profile-evidence)
only when the rendered marker is present in the response body.

## T

### Transport tier

Which underlying transport produced an outcome: `http`, `impersonate`,
or `browser`. Stamped on every [verdict](#verdict) as
[`CheckOutcome.transport`](#checkoutcome-fields) <span class="since-chip">since v0.10</span> so downstream tools (doctor,
bench harness, SPA's transport chip, JSON consumers) can tell which
path produced each verdict.

## U

### Uncertain

The third verdict alongside `Found` / `NotFound`. Carries an
[`UncertainReason`](#uncertain-reasons) so the operator can tell *why*
the probe couldn't reach a binary answer. Adler's "honest verdicts"
identity: never silently degrade an Uncertain to NotFound just because
a CDN edge blocked the probe.

### Uncertain reasons

The closed set of reasons attached to an `Uncertain` verdict:
`rate_limited`, `cloudflare_challenge`, `captcha`, `robots_disallowed`,
`deadline`, `scheduler_closed`, `network(detail)`, `body_read(detail)`,
`browser_budget`, `username_not_allowed`, `browser_failed(detail)`,
`geo_unavailable` <span class="since-chip">since v0.9</span>, `session_required` <span class="since-chip">since v0.10</span>, `other(detail)`.

## V

### Verdict

The three-state outcome of a probe: `Found` (account confirmed
present), `NotFound` (account confirmed absent on a *working*
response), or [`Uncertain`](#uncertain). Stored as
`MatchKind` in `adler-core`.

---

### CheckOutcome fields

For embedders: every probe returns a `CheckOutcome` carrying `site`,
`url`, `kind` (the [verdict](#verdict)), `reason` (only when
`Uncertain`), `elapsed_ms`, `transport`, `escalations`, signal
`evidence`, normalized `profile_evidence`, and `confidence`. Full Rust API on
[docs.rs/adler-core](https://docs.rs/adler-core).
