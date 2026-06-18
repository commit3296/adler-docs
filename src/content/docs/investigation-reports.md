---
title: Investigation reports
description: Generate local case files from finished scans — Markdown, JSON, HTML, Web API exports, and MCP report surfaces.
---

<p class="audience-badge audience-operator">For operators · case files</p>
<p class="audience-badge audience-embedder">For embedders · report model</p>
<span class="type-chip type-howto">How-to</span>

<aside class="tldr">

- Reports are generated from **finished persisted scans**.
- CLI: `adler --report-scan <ID>` renders Markdown by default; add
  `--report-format json` or `--report-format html` for other formats.
- Web: `/api/scan/:id/report?format=json|markdown|html` exposes the
  same model, and the finished scan view links downloads.
- MCP: `get_investigation_report` and `adler://reports/{id}` expose
  JSON / Markdown case summaries to agents.
- Reports are **derived read-time artifacts**: historical confidence
  overlays and clusters can be rebuilt in the response without rewriting
  the stored scan JSON.

</aside>

An Adler scan answers "what did each site say?" An investigation report
answers "what should I put in the case file?" It turns a finished scan
artifact into a structured summary with found accounts, evidence,
confidence, identity clusters, timeline context, and limitations.

Use reports when a scan result is leaving the terminal: handoff notes,
ticket attachments, agent summaries, audit trails, or downstream tools
that need stable JSON instead of CLI text.

## Prerequisite: a finished scan id

Reports read persisted scans from the scan history directory. By
default that is `~/.cache/adler/scans/`.

Useful ways to get a scan id:

```bash
adler --web
# Run a scan in the UI, then open History.

adler --watch alice
# Creates / updates persisted scan history for the username.

adler --scans-dir ./scans --web
# Use an explicit artifact directory for a case or test fixture.
```

Live scan JSON (`adler --format json alice`) intentionally remains a
top-level array of `CheckOutcome` objects. Reports are a separate
finished-scan surface so existing scan JSON consumers do not break.

## CLI reports

Markdown is the default and is meant for humans:

```bash
adler --report-scan scan_123 > report.md
```

JSON is the direct `InvestigationReport` model and is best for tools:

```bash
adler --report-scan scan_123 --report-format json > report.json
jq '.summary, .identity_clusters' report.json
```

HTML is a self-contained local case file:

```bash
adler --report-scan scan_123 --report-format html > report.html
```

The HTML renderer has inline CSS, no JavaScript, and does not load
external avatar images. Avatar URLs and avatar hashes appear as text
evidence rows instead of remote media.

If you keep scan artifacts outside the default cache, pass the same
directory to the report command:

```bash
adler --scans-dir ./case-scans --report-scan scan_123 --report-format html > report.html
```

## What the report contains

The JSON model is intentionally direct: no wrapper envelope, just
`InvestigationReport`.

| Section | Purpose |
| --- | --- |
| `schema_version` | Report contract version. Consumers should check it before assuming fields. |
| `username` | Username the scan investigated. |
| `summary` | Counts for found / not-found / uncertain rows, high-confidence accounts, evidence, clusters, and timeline events. |
| `found_accounts` | Every Found account with URL, signal evidence, profile evidence, confidence, transport, escalations, and cluster ids. |
| `high_confidence_accounts` | Focused shortlist for quick human review. |
| `evidence_table` | Normalized profile evidence across found accounts. |
| `identity_clusters` | Deterministic cluster candidates built from structured profile evidence. |
| `timeline` | Added / removed / reappeared / evidence-changed events from persisted history. |
| `limitations` | Explicit caveats such as low confidence or missing profile evidence. |

Confidence is conservative. Exact username evidence, authenticated
access, rich profile metadata, successful escalation, and historical
consistency can raise confidence. Session-required, blocked, CAPTCHA,
rate-limit, and weak status-only paths stay low or capped.

Identity clusters are deterministic leads, not biometric proof. Adler
does not merge accounts on username alone, and avatar hashes are
supporting evidence only. If a cluster has `uncertain: true`, preserve
that flag in your notes and downstream output.

## Web API and UI export

The Web UI exposes report downloads on finished scan views. There is no
separate report route in the SPA; the links call the report endpoint:

| Format | URL |
| --- | --- |
| JSON | `/api/scan/:id/report?format=json` |
| Markdown | `/api/scan/:id/report?format=markdown` |
| HTML | `/api/scan/:id/report?format=html` |

`format=json` is the default when the query parameter is omitted.

Error cases are explicit:

| Status | Error | Meaning |
| --- | --- | --- |
| `404` | `scan_not_found` | No in-memory or persisted scan has that id. |
| `400` | `scan_not_finished` | Reports are finished-scan only. |
| `400` | `invalid_report_format` | Format is not `json`, `markdown`, or `html`. |

When a persisted scan is read, Adler applies the same historical
confidence overlay used by `/api/scan/:id`, then rebuilds identity
clusters so member confidence matches the returned outcomes. The stored
artifact is not rewritten.

## MCP report surface

Agents should prefer report output for case-level summaries because it
combines evidence, confidence, clusters, and timeline context in one
contract.

Tool:

```json
{
  "name": "get_investigation_report",
  "arguments": {
    "scan_id": "scan_123",
    "format": "json"
  }
}
```

`format` defaults to `json`; `markdown` is available for note-style
responses. HTML is intentionally not exposed through MCP v1.

Resource:

```text
adler://reports/scan_123
```

The resource always returns JSON `InvestigationReport`.

## Privacy and retention

Report files contain the same sensitive facts as scan artifacts, plus a
more convenient summary of them. Treat report files as case material:

- Scan ids are effectively local read capabilities for artifacts.
- Evidence access metadata is non-secret by design: no session names,
  cookie/header values, proxy URLs, or egress names.
- Raw avatar image bytes are never written to artifacts or reports.
- HTML reports are local/offline-safe, but they still contain profile
  URLs, evidence values, cluster reasons, and timeline context.

For the full retention model, see
[Privacy and retention](https://github.com/commit3296/adler/blob/main/docs/privacy-retention.md)
in the main repository.

## Troubleshooting

### `scan_not_finished`

The scan is still running, or you are asking for a report from a live
SSE snapshot. Wait for the scan to finish, then request the report.

### Empty or missing clusters

Clusters require Found outcomes with structured profile evidence. Run
with enrichment when you need richer cluster inputs:

```bash
adler --enrich alice
```

Username-only matches intentionally do not create clusters.

### JSON report differs from old persisted JSON

This is expected. Reports are derived at read time. Adler can refresh
confidence and rebuild clusters from old artifacts without rewriting
the underlying scan JSON.

### I need exact per-site rows, not a case file

Use scan JSON instead:

```bash
adler --format json alice > outcomes.json
```

That shape is a top-level array of `CheckOutcome` objects. Use report
JSON when you want the case-level `InvestigationReport` model.
