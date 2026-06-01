---
title: FAQ
description: Common questions about Adler's behaviour, troubleshooting, and operator-facing edge cases. Bold answer first, explanation after.
---

<p class="audience-badge audience-operator">For operators · scanning</p>
<span class="type-chip type-howto">How-to</span>

Each question opens with a one-sentence answer in bold so you can scan
the FAQ in 30 seconds. Read the paragraph after it if you need the
context.

## Why is everything coming back as `Uncertain`?

**Your scan source is on a CDN blocklist — usually a datacenter IP that's
been mass-banned. Try a residential proxy, or the browser backend for
`bot-protected` sites.**

Datacenter IP ranges (Hetzner, OVH, Linode, AWS, …) are pre-banned by
Cloudflare, Akamai, and most major edges. From there, the cheap HTTP
path returns `Uncertain(cloudflare_challenge)` or `Uncertain(rate_limited)`
for a big chunk of the registry — not because the accounts don't exist,
but because nobody reachable from that IP gets a working response.

Three remedies, ranked by effort:

```bash
adler --proxy socks5://USER:PASS@HOST:PORT alice          # one global residential proxy
adler --proxy-pool pool.toml alice                        # per-site geo / IP-type routing
adler --browser-backend local alice                       # bot-protected sites via headless Chrome
```

`adler --explain alice` prints the signal that flagged each verdict so
you can tell *why* it was inconclusive (`cloudflare_challenge`,
`geo_unavailable`, `session_required`, …).

For sites that *systematically* sit behind Cloudflare without being
pre-tagged `bot-protected`, [automatic
escalation](/access-engine/#automatic-escalation) retries through the
browser backend on its own once `--browser-backend` is set.

## Why does Adler report fewer Found accounts than Sherlock or Maigret?

**Because Adler verifies its `NotFound`s. Sherlock and Maigret return
`NotFound` even when the response was a Cloudflare wall — Adler reports
`Uncertain(reason)` instead. Check the Uncertain bucket; most of the
"missing" hits are there with a reason.**

Adler's `NotFound` literally means "the site returned a working response
that says this account does not exist." Sherlock and Maigret count
"I got blocked at the first wall" the same way — that's a false
negative, not a verdict. Once you resolve the wall (browser backend,
residential IP, sessions), the Uncertain rows flip to Found.

See [Access engine](/access-engine/) for the toolkit and [Site
registry → Detection rate](/site-registry/#detection-rate) for the
quantified gap.

## How do I scan Instagram, X (Twitter), or Threads?

**They're tagged `bot-protected` — plain HTTP gets a login wall. Add
`--browser-backend local` (free, local Chrome) or `--browser-backend
browserbase` (paid, residential cloud). For Instagram specifically, add
a session via `--sessions` for authenticated profile data.**

These platforms detect every HTTP scrape and serve a login interstitial
that looks identical for an existing and a missing account. The browser
backend runs JS, accepts cookies, and returns the final post-render
DOM — same detection signals apply, real verdict comes out.

A session supplied via `--sessions sessions.toml` lets you reach
authenticated-only profile data on top:

```toml
[ig]
Cookie = "sessionid=...; csrftoken=..."
X-IG-App-ID = "936619743392459"
```

See [Access engine → Sessions](/access-engine/#sessions-reach-login-walled-sites).

## `--proxy` versus `--proxy-pool` — which do I want?

**`--proxy` routes everything through one proxy. `--proxy-pool` is
per-site: the registry declares "this site needs a UK residential IP",
Adler picks a matching egress; sites without a constraint use the
default. Mix them freely.**

`--proxy` is the brute-force lever — useful when your local network is
the problem and one residential exit fixes everything. `--proxy-pool` is
the precise lever — useful when specific sites need specific geos / IP
types and you don't want to round-trip the rest of the registry
through them.

The pool TOML accepts an optional `name` so you can pick a subset for a
single scan from the SPA's Advanced filters; see [Access engine →
Egress pool](/access-engine/#egress-pool-geo-routing) and [Web UI →
Per-scan egress subset](/web-ui/#per-scan-egress-subset).

## A site's signature is stale — how do I fix it?

**Run `adler --doctor --fix --only <site>`. It diffs present / absent
responses and prints a paste-ready corrected signal.**

Upstream Sherlock / Maigret signatures rot — sites change their response
markup, their `known_present` accounts get deleted, their CDN flips.
The doctor probes a [known-present](/glossary/#known-present) user
(must resolve to `Found`) and a random nonsense user (must not). Sites
where both halves agree pass; the rest get the `--fix` treatment.

`--doctor --suggest-known-present` is the complementary tool — it probes
a small candidate pool (the site's brand name plus `torvalds` /
`octocat` / `admin` / …) and prints a paste-ready snippet for sites
where it finds a live account.

A nightly GitHub Action runs the full doctor sweep across the registry
and flags structural rot. See [Site registry → Validating
signatures](/site-registry/#validating-signatures).

## Is it legal to use sock-puppet accounts with `--sessions`?

**Adler ships nothing here — you bring the session. Whether your
engagement authorises operating under a pseudonymous account against a
site's ToS is your call as an operator.**

We don't take a position on what your engagement scope authorises;
that's between you, your engagement, and the site's ToS. What Adler
*does* take a position on:

- **Authorised pentests, bug-bounty engagements, security research with a
  lawful basis** — fine. Adler is built for this.
- **Stalking, harassment, doxxing, mass-targeting individuals** — not
  fine, and not what this tool is for. See `SECURITY.md` and
  `CODE_OF_CONDUCT.md` in the repo for our ethics line.

## What's the difference between `transport: browser` and `transport: browser*`?

**No `*` = browser was the primary route (the site is pre-tagged
`bot-protected`). `*` = the cheap path returned `Uncertain` and the
router automatically escalated to the browser.**

The `*` suffix marks an outcome where automatic
[escalation](/glossary/#escalation) fired — the operator didn't ask for
the browser fetch, but a `cloudflare_challenge` or `rate_limited`
response on the cheap path made the router try the browser anyway.
That's the access engine catching the long-tail Cloudflare rollout
without you having to pre-tag every newly-walled site.

## Can I turn off automatic escalation?

**`--no-escalation` disables it. `--escalation-budget 0` is equivalent.
Use either when you want to benchmark the raw HTTP signals or stop a
Browserbase quota burning on surprise browser fetches.**

Three common reasons to disable:

- **Benchmarking** the cheap path's recall without the access engine's
  lift on top — comparable to Sherlock / Maigret then.
- **Cost control** when running on a Browserbase quota you don't want
  spent on surprise escalations.
- **Strict cheap-path semantics** for a CI-style gate that should only
  match what plain HTTP can confirm.

See [Access engine → Automatic
escalation](/access-engine/#automatic-escalation) for the reason
whitelist (escalation triggers on `cloudflare_challenge` and
`rate_limited` only — operator-policy Uncertains are kept as-is).

## My `adler --web` is on `0.0.0.0`. What should I worry about?

**Anyone on your network can hit the JSON API. Proxy URLs and session
secrets aren't exposed (`/api/access` returns names + countries + kinds
only), but `POST /api/scan` lets a stranger consume your `--proxy-pool`
quota and `--browser-budget`. Put auth in front of any non-loopback
bind.**

`adler --web` binds to `127.0.0.1` by default. Switching to
`--web-bind 0.0.0.0:9000` opens the API to your network. Adler's API
deliberately doesn't surface proxy credentials or session header
values — even `GET /api/access` only returns the (name, country, kind)
triples — but a wide-open `POST /api/scan` still lets a stranger
trigger scans that consume your pool quota, browser budget, and
escalation budget.

Reverse-proxy patterns that work:

- **Caddy** with a Basic Auth directive
- **Traefik** with a forward-auth middleware (e.g. Authelia / Authentik)
- **nginx** with `auth_basic`

Adler is not built to be exposed to the open internet. See [Web UI →
Security notes](/web-ui/#security-notes).
