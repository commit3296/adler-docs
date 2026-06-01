---
title: Site registry
description: Where the ~3,000-site registry comes from, how detection signals work, and how to validate / heal stale signatures.
---

<p class="audience-badge audience-contributor">For contributors · registry</p>
<p class="audience-badge audience-operator">For operators · context</p>

## Lineage

The default registry (`adler-core/data/sites.json`, ~2.5k sites) is
generated from MIT-licensed upstream data — the [Sherlock
project](https://github.com/sherlock-project/sherlock) (base) plus the
[Maigret project](https://github.com/soxoj/maigret) (engine-inherited
forum platforms and additional sites) — via `scripts/import_sherlock.py`
and `scripts/import_maigret.py`.

A supplementary registry derived from
[WhatsMyName](https://github.com/WebBreacher/WhatsMyName) ships in
`adler-core/data/sites_wmn.json` and is **included by default** for
maximum coverage — it adds ~675 sites with two-sided body+status
detection signatures. The file is licensed CC BY-SA 4.0; if you
redistribute Adler scan output and need an MIT-only data lineage, pass
`--no-wmn` to drop the tranche.

## Detection signals

Each site is probed with *multi-signal detection*: the HTTP status, body
markers, and redirect behaviour are combined into one verdict — `Found`,
`NotFound`, or `Uncertain(reason)` — rather than relying on a single
status check. This lowers false positives on sites that return `200`
for every username.

The signal pipeline is **negative-priority**: any `NotFound` vote wins
over `Found`; no votes → `Uncertain`. A per-site `regex_check` mismatch
short-circuits with `Uncertain(UsernameNotAllowed)` before any HTTP
request, so the engine doesn't spend a network round-trip on
syntactically illegal usernames.

The full schema lives at
[`docs/sites.schema.json`](https://github.com/commit3296/adler/blob/main/docs/sites.schema.json)
in the repository.

## Detection rate

Recall depends on where you scan from. A `--doctor` pass on 2026-05-26
against the bundled registry (411 sites):

| Scan source | Sites where a known-existing account is found | Recall |
| --- | ---: | ---: |
| Datacenter IP (Hetzner / Leaseweb DE) | 282 / 411 | 68.6% |
| US residential proxy pool (DECODO) | **305 / 411** | **74.2%** |

The residential lift is real: ~40 sites swap their verdict between
`Uncertain` (datacenter) and `Found` (residential) — most are
Cloudflare-walled or geo-restricted (RU-segment, plus platforms like
Reddit, Imgur, Patreon). The remaining ~26% breaks down roughly as:

- **Bot-protected sites** tagged `bot-protected` (Instagram and X /
  Twitter today) — these serve a JS login wall to a plain HTTP request;
  a clean IP doesn't help, you need a browser backend. Exclude them with
  `--exclude-tag bot-protected`.
- **Stale Sherlock-imported `known_present` accounts** that no longer
  exist on the live site. The `--doctor --suggest-known-present` tool
  (new in v0.4.0) probes a small candidate pool (the site's brand name,
  plus `torvalds` / `octocat` / `admin` / …) and prints a paste-ready
  snippet for any site where it finds a live account. Discovery surfaced
  19 healable entries on the most recent sweep; the remaining
  placeholders need either a contributor-found candidate or a deeper
  repair via `--doctor --fix`.
- **Sites whose detection rule fires for *every* username** — signal
  repair territory, not username repair. `--doctor --fix` diffs the
  responses and proposes a tighter signal.
- **Sites that don't reliably distinguish found from not-found** for
  unauthenticated requests at all — investigated and not added rather
  than ship false-positive entries: Reddit, TikTok, Pinterest, and
  Threads. See issues
  [#11–#14](https://github.com/commit3296/adler/issues?q=is%3Aissue+label%3A%22help+wanted%22)
  for the specific failure modes and what would unblock each.

Run the same check yourself: `adler --doctor` (uses your current IP) or
`adler --doctor --proxy <url>` (via your own proxy). With
`--browser-backend browserbase` the doctor's `--fix` mode routes
bot-protected sites through a real Chrome session, so the diff sees real
profile pages rather than two identical login walls. With
`--suggest-known-present` you get an `OVERRIDES` block per healable
site.

## Validating signatures

Detections are imported **unverified** — upstream signatures rot over
time. Validate them with the built-in health check:

```bash
adler --doctor                 # check every site's signature
adler --doctor --only github   # check a subset
```

`--doctor` probes each site's known-present user (must be Found) and a
random nonsense user (must not be Found), reporting any site whose
detection no longer holds. `--doctor --fix` additionally suggests a
corrected signature for failing sites by diffing the present/absent
responses. A nightly GitHub Actions workflow
(`.github/workflows/doctor.yml`) runs the check across the whole
registry and flags structural rot.

## Performance

A scan is network-bound: the engine itself is negligible. The
`executor::run` benchmark (`cargo bench -p adler-core`) fans out 50
probes against a local mock server in **~1.6 ms total — roughly 32 µs
per site** of framework overhead (~30K sites / s), while a real HTTP
request takes 100–1000 ms. So wall-clock time is set almost entirely by
how many requests are in flight.

The lever that matters is therefore concurrency, not micro-optimisation:

- `--concurrency` (default **32**) bounds in-flight probes. Most sites
  are distinct hosts, so the per-host throttle rarely serialises;
  raising it (e.g. `--concurrency 64`) shortens large scans, with
  diminishing returns past your network's limits.
- The result cache (`~/.cache/adler/`) skips re-probing unchanged sites
  between runs entirely.
- `--max-rps` trades throughput for politeness when you need a global
  cap.
