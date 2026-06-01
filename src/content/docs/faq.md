---
title: FAQ
description: Common questions about Adler's behaviour, troubleshooting, and the operator-facing edge cases.
---

## Why is everything coming back as `Uncertain`?

Almost always a datacenter IP that's been mass-banned at the CDN edge.
Try `--proxy socks5://...` with a residential proxy, or
`--browser-backend local` for sites tagged `bot-protected`.
`adler --explain alice` prints the signal that flagged each verdict, so
you can tell *why* it was inconclusive (`cloudflare_challenge`,
`geo_unavailable`, `session_required`, …).

For sites that *systematically* sit behind Cloudflare or rate-limit edges
without being pre-tagged `bot-protected`, [Automatic
escalation](/access-engine/#automatic-escalation) will retry
through the browser backend on its own — no manual intervention needed.

## Why does Adler report fewer Found accounts than Sherlock or Maigret?

Adler's `NotFound` means "verified absent from a working response."
Sherlock and Maigret return `NotFound` even when the response was a
Cloudflare wall, login page, or anti-bot challenge — those are false
negatives.

Check Adler's `Uncertain` bucket: most of the apparent "missing" hits are
there, with a *reason*. Resolve the wall (browser, residential IP,
sessions) and they flip to `Found`. See [Access engine](/access-engine/)
for the toolkit.

## How do I scan Instagram / X (Twitter) / Threads?

They're tagged `bot-protected` — plain HTTP gets a login wall. Use
`--browser-backend local` (free, local Chrome) or `--browser-backend
browserbase` (paid, residential cloud). For Instagram specifically,
supplying a session via `--sessions` lets you reach the authenticated
profile (see [Access engine → Sessions](/access-engine/#sessions-reach-login-walled-sites)).

## `--proxy` vs `--proxy-pool` — which do I want?

`--proxy` routes *everything* through one proxy. `--proxy-pool` is
per-site: the registry declares "this site needs a UK residential IP",
Adler picks a matching egress from the pool; sites without a constraint
use the default. Mix them freely.

See [Access engine → Egress pool](/access-engine/#egress-pool-geo-routing)
for the TOML format and the geo / IP-type matching rules.

## A site's signature is stale — how do I fix it?

`adler --doctor --only <site>` reproduces the failure; `adler --doctor
--fix --only <site>` diffs present/absent responses and proposes a
corrected signature. Paste it into a local override or open a PR.

The [`--doctor` workflow is described in
detail](/site-registry/#validating-signatures) on the site
registry page.

## Is it legal to use sock-puppet accounts for `--sessions`?

Adler ships nothing here — you bring the session. Whether your engagement
authorises operating under a pseudonymous account against a site's ToS is
an operator decision; check the project's `SECURITY.md` and
`CODE_OF_CONDUCT.md` for our ethics line. In short:

- Authorised penetration tests, bug-bounty engagements, security research
  with a lawful basis — fine.
- Stalking, harassment, doxxing, mass-targeting individuals — not fine,
  and not what this tool is for.

## What's the difference between `transport: browser` and `transport: browser*`?

The `*` suffix marks an outcome where the *cheap* transport (HTTP or
impersonate) hit `Uncertain(cloudflare_challenge | rate_limited)` and the
router automatically escalated to the browser. Without the `*`, the
browser was the primary route (the site is pre-tagged `bot-protected`).

You'll see `*` chips show up organically as Cloudflare rolls out new
edge rules to sites we hadn't pre-tagged — that's the access engine
catching the long tail.

## Can I turn off automatic escalation?

`--no-escalation`, or `--escalation-budget 0`. Useful when:

- Benchmarking the raw HTTP signals without the access engine's lift on
  top.
- You're running on a Browserbase quota you don't want spent on
  surprise escalations.
- You want strict cheap-path semantics for a CI-style gate.

See [Access engine → Automatic escalation](/access-engine/#automatic-escalation)
for what triggers escalation and what reasons are deliberately ignored.

## My web UI is on `0.0.0.0`, what should I worry about?

`adler --web` binds to `127.0.0.1` by default. If you switched it to
`--web-bind 0.0.0.0:9000`, anyone on the network can hit the JSON API.
Adler's API deliberately doesn't expose proxy URLs or session header
values — even `GET /api/access` only returns names + countries + kinds.
But a wide-open `POST /api/scan` still lets a stranger consume your
`--proxy-pool`, `--browser-budget`, and `--escalation-budget`.

Put a reverse proxy with auth (Caddy, Traefik, nginx) in front of any
non-loopback bind. Adler is not built to be exposed to the open
internet.
