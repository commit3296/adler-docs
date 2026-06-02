---
title: Quickstart
description: First scan in under a minute.
---

<p class="audience-badge audience-operator">For operators · running scans</p>
<span class="type-chip type-tutorial">Tutorial</span>

## Your first scan

After [installing](/install/), scan one username across the
embedded registry:

```bash
adler torvalds
```

The text view streams Found and Uncertain rows as they resolve. NotFound
rows are hidden by default — pass `--all` to include them, or pipe to
`jq` for a machine-readable list:

```bash
adler --format ndjson torvalds | jq -r 'select(.kind == "found") | .url'
```

## Logging

Adler's tracing output is gated by the `ADLER_LOG` env var (defaults to
`adler=info`):

```bash
ADLER_LOG=adler=debug adler torvalds
```

## Common next steps

- **Filter to specific sites or tags** — `adler --tag dev --only git`
  scans only `dev`-tagged sites whose name contains `git`. See
  [Usage → Filtering](/usage/#filtering).
- **Output as JSON / CSV / HTML** — `adler --format json torvalds > out.json`,
  `--format csv`, or `--format html` for a self-contained report. See
  [Usage → Output](/usage/#output).
- **Use the web UI** — `adler --web` boots a SolidJS SPA at
  `http://127.0.0.1:8080` with live SSE streaming, history, side-by-side
  diff, and a read-only access-engine view. See [Web UI](/web-ui/).
- **Scan many usernames** — `adler --input users.txt` runs through a list,
  grouped output. See [Usage → Batch & enrichment](/usage/#batch--enrichment).
- **Watch for changes** — `adler --watch torvalds` diffs against the last
  run and reports new / removed accounts.

## When something looks off

A whole-registry scan from a fresh datacenter IP often returns a lot of
`Uncertain` rows — that's not Adler "not working", that's the CDN edge
mass-banning the IP range. See [FAQ → Why is everything coming back as
`Uncertain`?](/faq/#why-is-everything-coming-back-as-uncertain)
for the residential-IP / browser-backend remedies.

For sites that *always* return Uncertain because they sit behind
Cloudflare / a TLS-fingerprint check / a login wall, see
[Access engine](/access-engine/) — that's the whole point of
the engine.

## What's next?

- **[First scan walkthrough](/first-scan/)** — the guided ~15-minute
  tutorial: run a scan, read the verdicts, fix the dominant `Uncertain`
  reason, prove the remedy worked, save the workflow. The right next
  step if this Quickstart felt too fast.
- **[Honest verdicts](/honest-verdicts/)** — the philosophy behind the
  three-verdict model. Read this before scaling Adler in a serious
  engagement; it'll change how you read the output.
- **[Access engine](/access-engine/)** — the full toolkit (browser
  backend, escalation, egress pool, sessions, impersonation) for the
  hard subset of sites a plain HTTP scan can't reach.
- **[Web UI](/web-ui/)** — `adler --web` boots a SolidJS SPA with live
  streaming, history, side-by-side diff, and a read-only access view.
