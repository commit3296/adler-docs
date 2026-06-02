---
title: First scan walkthrough
description: A guided tutorial that takes you from a fresh install to a useful scan result you understand and can iterate on. ~15 minutes.
---

<p class="audience-badge audience-operator">For operators · running scans</p>
<span class="type-chip type-tutorial">Tutorial</span>

<aside class="tldr">

Seven steps, ~15 minutes:

1. **Install** with `cargo binstall adler-cli`.
2. **Run** `adler torvalds` and read the streaming output.
3. **Understand** the three verdicts — `Found`, `NotFound`, `Uncertain(reason)`.
4. **Aggregate** Uncertain reasons with `--format ndjson | jq` to find the dominant cause.
5. **Remedy** the dominant cause — usually a residential proxy via `--proxy socks5://...`.
6. **Compare** before / after by diffing the NDJSON dumps.
7. **Automate** with `--watch` or the bundled web UI (`--web`).

</aside>

This tutorial takes you end-to-end on your first scan — installing
Adler, running it, reading the output, hitting `Uncertain`, fixing
`Uncertain`, watching the verdict improve, and saving the workflow for
next week. It's longer than the [Quickstart](/quickstart/) because the
goal here isn't a 60-second demo; it's making sure you actually
*understand* what Adler is doing before you scale it up.

You'll spend about 15 minutes. By the end, you'll have:

- A working install
- One real scan you've inspected
- A working remedy for at least one `Uncertain` row
- A repeatable workflow (`--watch`) for tracking the same name week to
  week

---

## Step 1 — Install

Pick whichever path matches your machine; both arrive at the same
`adler` binary on `PATH`:

```bash
# Pre-built binaries (fastest)
cargo binstall adler-cli

# Or compile from source (~1–2 min)
cargo install adler-cli
```

If you want the [TLS-fingerprint impersonation](/access-engine/#tls-fingerprint-impersonation)
transport (Chrome 134 handshake emulation; needed for some sites tagged
`protection: tls-fingerprint`), add `--features impersonate` to the
`cargo install` flavour. The `binstall` flavour ships impersonate
pre-built on 4/5 supported targets.

Confirm:

```bash
adler --version
# adler 0.11.0
```

The [Install](/install/) page covers every flavour in more depth if
you hit a build error.

---

## Step 2 — Your first scan

Pick a username you know exists on at least one site — a real human's
GitHub handle works. We'll use `torvalds`:

```bash
adler torvalds
```

What you see:

- **Text streams in as outcomes resolve** — that's the default
  interactive renderer. Found rows in green, Uncertain rows in amber,
  NotFound rows hidden by default (pass `--all` to include them).
- **Categorised** — `dev`, `social`, `forum`, etc., based on each
  site's tags.
- **Per-row metadata** at the right — elapsed time, verdict reason for
  Uncertain rows, the [transport](/glossary/#transport-tier) chip when
  it's not plain HTTP.

Expect mostly `Found` for `torvalds` (he's on a lot of dev platforms)
and a sprinkle of `Uncertain` (CDN edges, login walls).

---

## Step 3 — Understanding the output

The verdict model is the most important thing in Adler. Three states:

| State | What it means | Trust it? |
|---|---|---|
| `Found` | The site returned a working response that confirms the account exists. | Yes. |
| `NotFound` | The site returned a working response that confirms the account does *not* exist. | Yes. |
| `Uncertain(reason)` | The site responded, but the response can't tell `Found` from `NotFound`. The `reason` says why. | No — and you should figure out *why*. |

Adler's whole identity is in that third row. See
[Honest verdicts](/honest-verdicts/) for the philosophy; the practical
implication is: an `Uncertain` is *not* a failure of Adler, it's
information about the site or your network.

For the verdict reasons, inspect any individual row with `--explain`:

```bash
adler --explain --only github,gitlab torvalds
```

You'll see the signal that produced each verdict. On `Found`, that's
the matching status / body marker / redirect rule. On `Uncertain`,
it's the [`UncertainReason`](/glossary/#uncertain-reasons) — typically
something like `cloudflare_challenge`, `rate_limited`, `geo_unavailable`,
or `session_required`.

---

## Step 4 — Why is anything Uncertain?

Almost always the answer is *your scan source*. Datacenter IPs (the
default for cloud VMs and most home dev boxes routed through corporate
egress) are pre-banned at CDN edges like Cloudflare and Akamai. From
those IPs, sites that work fine in a browser return interstitial
challenges to plain HTTP — and Adler honestly reports
`Uncertain(cloudflare_challenge)` rather than guessing.

To confirm this is what's happening, pipe a JSON dump through `jq`:

```bash
adler --format ndjson torvalds | \
    jq -r 'select(.kind == "uncertain") | "\(.site)\t\(.reason)"' | \
    sort | uniq -c | sort -rn
```

If the top reasons are `cloudflare_challenge` / `rate_limited` —
that's a network problem, not an Adler bug. Step 5 fixes it.

If the top reason is `geo_unavailable` — that site has an [access
policy](/glossary/#access-policy) that needs a country-specific egress;
see [Access engine → Egress pool](/access-engine/#egress-pool-geo-routing).

If the top reason is `session_required` — that site needs a logged-in
session; see [Access engine →
Sessions](/access-engine/#sessions-reach-login-walled-sites).

---

## Step 5 — Your first remedy

Cheapest first: tell Adler to route through a residential proxy. Any
SOCKS5 or HTTP proxy you control works — paid residential pools
(BrightData, DECODO, IPRoyal, Smartproxy) typically give you the best
ratio of low ban rate per dollar, but a Tor exit also works in a pinch
(slow, but unbanned by most non-Cloudflare edges):

```bash
adler --proxy socks5://USERNAME:PASSWORD@HOST:PORT torvalds
# Or, for a one-off Tor sweep:
adler --tor torvalds
```

Re-run the `jq` aggregation from Step 4 against the new output. The
`cloudflare_challenge` and `rate_limited` rows should shrink dramatically
— sometimes to zero.

If you want to handle the `bot-protected` subset (Instagram, X) too,
add a browser backend on top:

```bash
adler --proxy socks5://... \
      --browser-backend local \
      torvalds
```

Local Chrome (`--browser-backend local`) is free; Browserbase's cloud
sessions (`--browser-backend browserbase`, ~\$0.05/min) buy you a
residential-IP-with-anti-fingerprinting backend for the bot-protected
edge cases. Both bounded by `--browser-budget` (default 50 fetches per
scan) so a misconfigured flag can't burn a quota.

---

## Step 6 — Compare the before and after

You can prove the remedy worked with the built-in cache + the
[Doctor](/glossary/#doctor):

```bash
# Save the "before" snapshot
adler --format ndjson torvalds > before.ndjson

# Switch to remedied config and re-scan
adler --proxy socks5://... \
      --browser-backend local \
      --format ndjson torvalds > after.ndjson

# Diff the verdict counts
for f in before.ndjson after.ndjson; do
    echo "=== $f ==="
    jq -r '.kind' "$f" | sort | uniq -c
done
```

Expected shape: `found` goes up, `uncertain` goes down. NotFound stays
roughly flat (unless Adler now sees sites where the proxy IP is itself
banned — possible but rare on quality residential pools).

---

## Step 7 — Make it a workflow

Two patterns to graduate from "one-off scan" to "I monitor this name":

**Pattern A — watch mode.** Re-scan periodically and surface diffs:

```bash
adler --watch torvalds                   # diff vs last cached run
adler --watch --interval 86400 torvalds  # re-scan every 24h
```

The watch mode keeps the scan cache at `~/.cache/adler/` and prints
only the rows that *changed* — new accounts, removed accounts, flipped
verdicts. Pipe it into your alert channel of choice.

**Pattern B — Web UI for visual review.** If you want a real interface
with history, side-by-side diff, evidence drawers, and the [access
engine view](/web-ui/#access-engine-view), launch the bundled SPA:

```bash
adler --web
# http://127.0.0.1:8080
```

See the [Web UI](/web-ui/) page for the full feature tour.

---

## What you've learned

- Adler's three-verdict model and why `Uncertain` is information, not
  failure.
- How to inspect verdict reasons with `--explain` and `--format ndjson`.
- That datacenter IPs cause most `Uncertain`s and how to remedy them.
- How to layer a residential proxy + browser backend.
- Two workflow patterns for tracking a name over time.

## Where to read next

- [**Access engine**](/access-engine/) — the full toolkit (browser
  backend, escalation, egress pool, sessions, impersonation) once you
  hit edge cases this tutorial didn't cover.
- [**Web UI**](/web-ui/) — the SPA's feature tour, including per-scan
  egress subset selection from the Advanced filters modal.
- [**Honest verdicts**](/honest-verdicts/) — the philosophy doc behind
  the three-verdict model.
- [**FAQ**](/faq/) — common edge cases and gotchas.
- [**Glossary**](/glossary/) — terminology lookup.
