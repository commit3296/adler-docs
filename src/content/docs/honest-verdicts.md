---
title: Honest verdicts
description: Why Adler returns Uncertain(reason) instead of guessing — the principle, the contrast with binary-verdict tools, and the operator implication.
---

<p class="audience-badge audience-operator">For operators · scanning</p>
<p class="audience-badge audience-embedder">For embedders · Rust</p>
<span class="type-chip type-explanation">Explanation</span>

Adler reports three verdicts per probe — `Found`, `NotFound`, and
`Uncertain(reason)` — instead of the binary `Found` / `NotFound` model
most username-search tools use. This page exists because that single
choice colours every other design decision in the engine. If you
understand the principle here, the rest of the docs make sense by
default.

## The principle

> A username-search tool exists to answer one question: *does an
> account with this name exist on this site?* The honest answer to that
> question is three-valued, not two-valued. Some sites refuse to tell
> us; the right answer for those is "we don't know — and here's why,"
> not "the account doesn't exist."

That's it. Everything below follows.

## The three verdicts

Each probe lands in exactly one bucket:

| State | What it means | The site's response was |
|---|---|---|
| `Found` | The account exists. | A working response that confirms it. |
| `NotFound` | The account does not exist. | A working response that confirms it. |
| `Uncertain(reason)` | We can't tell, and here's why. | A response that *isn't* a working signal — a CDN block, a rate-limit, a login wall, a captcha, an interstitial. |

The cleavage between `NotFound` and `Uncertain` is the entire principle.
A `NotFound` from Adler means *the site told us this account doesn't
exist*. An `Uncertain(cloudflare_challenge)` means *the site was blocked
by Cloudflare's bot edge before we could ask*. Those are categorically
different facts, and treating them as the same fact is the bug we're
trying not to ship.

## Why "Uncertain" matters

Look at the Sherlock / Maigret model. They scan ~3,000 sites, return
`Found` or `NotFound` for each, and produce a report. Run that against a
fresh datacenter IP — Hetzner, Linode, an AWS box — and ~30% of the
"NotFound" rows are actually walls.

The operator sees a clean-looking list of ~2,100 NotFounds and ~900
Founds. They reason: "the target doesn't have accounts on those
2,100 sites." That reasoning is wrong on roughly 600 of them, because
those 600 sites *did not return a verdict* — they returned a wall.
The tool *guessed* `NotFound`. The operator inherited the guess.

In a red-team / OSINT engagement, that's a load-bearing wrong belief.
You might pivot away from an account that does exist on Reddit because
your tool quietly told you it didn't. You might write a report that
says "no Patreon presence" because your tool quietly couldn't reach
Patreon from your IP.

Adler's `Uncertain` makes the guess impossible. The row reads
`Uncertain(cloudflare_challenge)` and the operator has three choices:

1. Accept the uncertainty (the data point is genuinely missing).
2. Resolve it with the [access engine](/access-engine/) — proxy, browser,
   session, escalation.
3. Investigate manually for that specific site.

All three are honest. Option (1) is something the operator opts into
deliberately, not something the tool decides for them.

## A concrete contrast

Same scan, same target (`blue`), same network (a US-residential proxy).
Tools side by side:

| Site | Sherlock | Maigret | Adler |
|---|---|---|---|
| GitHub | Found | Found | Found |
| Reddit | NotFound | NotFound | **Uncertain(cloudflare_challenge)** |
| Patreon | NotFound | NotFound | **Uncertain(cloudflare_challenge)** |
| Instagram | NotFound | NotFound | **Uncertain(browser_required)** |
| GitLab | Found | Found | Found |
| Twitch | NotFound | NotFound | Found *(after escalation to browser)* |

Sherlock and Maigret report `blue` as absent from Reddit, Patreon,
Instagram, and Twitch. Adler reports four pieces of *information* — three
Uncertains with reasons, plus one Found that came back after the
[automatic escalation](/access-engine/#automatic-escalation) tried the
browser path on a Cloudflare wall.

The operator now knows:

- `blue` on Reddit / Patreon: needs a residential IP or a browser fetch
  to resolve.
- `blue` on Instagram: bot-protected, needs the browser backend.
- `blue` on Twitch: account exists — the escalation just found it.

None of that information is recoverable from the binary-verdict
versions.

## The Uncertain reason taxonomy

`Uncertain` is never bare — it always carries a reason from a closed,
documented set:

| Reason | What happened | Operator remedy |
|---|---|---|
| `rate_limited` | HTTP 429 or 503 with `Retry-After`. | Slow down (`--max-rps`), rotate IP. |
| `cloudflare_challenge` | Cloudflare interstitial / "Just a moment...". | Browser backend, residential IP. |
| `captcha` | Captcha gate. | Manual; Adler does not solve. |
| `robots_disallowed` | Operator opted into `--respect-robots`. | Drop the flag if your engagement allows. |
| `deadline` | Per-scan timeout elapsed. | Raise `--deadline-secs` or narrow the filter. |
| `network(detail)` | TCP refused, DNS failure, TLS handshake error. | Network / DNS investigation. |
| `body_read(detail)` | The site returned headers but the body never finished. | Likely transient; retry. |
| `browser_budget` | `--browser-budget` exhausted before this site got its turn. | Raise the budget or narrow the scan. |
| `username_not_allowed` | Site's `regex_check` says the username isn't a legal pattern on this site. | None — Adler short-circuited before any request. |
| `browser_failed(detail)` | Browser backend itself errored. | Driver / version mismatch; see [Browser backend](/access-engine/#browser-backend). |
| `geo_unavailable` | Site requires a country-specific egress not in the pool. | Add the egress to `--proxy-pool` or accept the Uncertain. |
| `session_required` | Site's access policy names a session not in `--sessions`. | Supply the named session or accept the Uncertain. |
| `other(detail)` | Anything else (e.g. doctor pre-flight skip). | Read the detail. |

The full enum lives in
[`UncertainReason`](https://docs.rs/adler-core/latest/adler_core/enum.UncertainReason.html)
on docs.rs.

## What this means for you

**As an operator.** Treat `Uncertain` as a *signal* to take an action,
not a result to ignore. The access engine exists to convert
`Uncertain`s into binary verdicts; the cases that survive escalation
genuinely have no verdict, and you can either accept that or
investigate manually. Either way, you're not pivoting away from an
account that actually exists.

**As an embedder.** When you wrap `CheckOutcome` in your own pipeline,
preserve the `Uncertain` branch. Don't silently downgrade
`Uncertain(geo_unavailable)` to `NotFound` for downstream consumers —
that re-introduces the bug Adler exists to avoid. If your downstream
must be binary, surface the `Uncertain` reasons in your output and let
the next layer decide.

**As a benchmarker.** When you compare Adler's recall to Sherlock or
Maigret, separate three buckets: confirmed-Found, confirmed-NotFound,
and `Uncertain(*)`. The headline recall of binary-verdict tools is
inflated by counting walls as `NotFound`; Adler's "lower" recall is
the same number on a more honest denominator. The [bench
harness](https://github.com/commit3296/adler/tree/main/bench) in the
main repo isolates these.

## Where this principle lives in the code

`MatchKind` and `UncertainReason` are the type-system enforcement.
`MatchKind` is the three-variant enum (`Found`, `NotFound`,
`Uncertain`); `UncertainReason` is the closed enum carried by the
third variant. Both are public in
[`adler-core`](https://docs.rs/adler-core).

The router in `Client::probe_once` never returns a bare `NotFound` for
a probe that was blocked at the network or CDN edge — every
`Uncertain`-producing path in the engine explicitly attaches a reason
before the outcome leaves the function. The [bot-detection
heuristics](https://github.com/commit3296/adler/blob/main/adler-core/src/ban.rs)
codify what counts as a "we got blocked" response so the rest of the
engine doesn't have to reason about it.

When someone proposes a change that would let a `NotFound` escape from
a blocked response, the right thing to say is "no, we don't ship that
even to look better in a comparison table." That position is what this
project is, more than any specific feature.

## Where to read next

- [**FAQ → Why does Adler report fewer Found accounts than Sherlock or Maigret?**](/faq/#why-does-adler-report-fewer-found-accounts-than-sherlock-or-maigret)
  — the operational restatement of this principle.
- [**Access engine**](/access-engine/) — the toolkit that converts
  `Uncertain` into `Found` / `NotFound` when you want to.
- [**Glossary → Uncertain**](/glossary/#uncertain) — short-form
  definition for cross-link.
