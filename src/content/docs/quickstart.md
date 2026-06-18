---
title: Quickstart
description: First scan, explainability check, and case-file export path.
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
rows are hidden by default. Each visible row can include a conservative
confidence score; `--explain` adds the signal evidence and confidence
reasons under the row:

```bash
adler --explain --only github,gitlab torvalds
```

For machine-readable output, pipe NDJSON to `jq`:

```bash
adler --format ndjson torvalds | jq -r 'select(.kind == "found") | .url'
```

## Enrich when you need identity evidence

Plain scans answer "does this account exist?". Add `--enrich` when you
need profile evidence such as display names, bio snippets, avatar URLs,
external links, locations, and confidence inputs:

```bash
adler --enrich --explain --only github,gitlab torvalds
```

Identity clusters are built only from deterministic structured evidence
on Found outcomes. Username-only overlap is intentionally ignored.

## Export a case file

The easiest first case-file path is through the Web UI because finished
scans are persisted and the scan id is visible in the URL:

```bash
adler --web
# open http://127.0.0.1:8080, run a scan, then use the JSON / Markdown / HTML export links
```

The same persisted scan can be rendered from the CLI:

```bash
adler --report-scan <SCAN_ID> > report.md
adler --report-scan <SCAN_ID> --report-format html > report.html
```

Reports combine summary counts, found accounts, signal evidence,
profile evidence, confidence reasons, identity clusters, timeline
context, and limitations. See [Investigation reports](/investigation-reports/).

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
- **Output scan rows as JSON / CSV / HTML** — `adler --format json torvalds > out.json`,
  `--format csv`, or `--format html`. Case-file output uses
  `--report-scan`; see [Usage → Output](/usage/#output).
- **Use the web UI** — `adler --web` boots a SolidJS SPA at
  `http://127.0.0.1:8080` with live SSE streaming, evidence drawers,
  confidence chips, identity clusters, report exports, history,
  side-by-side diff, and a read-only access-engine view. See
  [Web UI](/web-ui/).
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
  tutorial: run a scan, read verdicts and confidence, inspect evidence,
  fix the dominant `Uncertain` reason, export a case file, save the
  workflow. The right next step if this Quickstart felt too fast.
- **[Honest verdicts](/honest-verdicts/)** — the philosophy behind the
  three-verdict model. Read this before scaling Adler in a serious
  engagement; it'll change how you read the output.
- **[Access engine](/access-engine/)** — the full toolkit (browser
  backend, escalation, egress pool, sessions, impersonation) for the
  hard subset of sites a plain HTTP scan can't reach.
- **[Web UI](/web-ui/)** — `adler --web` boots a SolidJS SPA with live
  streaming, evidence/confidence views, clusters, report exports,
  history, side-by-side diff, and a read-only access view.
