---
title: Usage
description: Common CLI flags grouped by intent — filtering, output, network, browser, cache, batch, and enrichment.
---

`adler <username>` scans the embedded registry; everything else is a
knob. Text output shows Found and Uncertain rows by default and hides
NotFound — pass `--all` for the full list. Results stream into a terminal
as they resolve; piped output is collected and ordered. For a browser
view, pass `--web` (see [Web UI](/adler-docs/web-ui/)).

Exit codes: `0` something found, `1` nothing found, `2` error.

`adler --help` has the complete flag reference; the buckets below cover
the common ones by intent.

## Filtering

```bash
adler --only github,gitlab alice         # restrict to matching site names
adler --exclude reddit alice             # drop matching site names
adler --tag social,dev alice             # filter by tag(s)
adler --tag region:ru alice              # by region tag
adler --exclude-tag bot-protected alice  # skip login-walled sites
adler --list-sites --only git            # discover filter terms (no scan)
adler --list-tags                        # show all tags + counts
```

## Output

```bash
adler --format json alice > out.json     # JSON array
adler --format ndjson alice              # one JSON object per line (jq-friendly)
adler --format csv alice > out.csv       # spreadsheet table
adler --format html alice > out.html     # self-contained HTML report
adler --all alice                        # include NotFound rows
adler -q alice                           # quiet: only Found URLs
adler --explain alice                    # show which signal produced each verdict
adler --color never alice                # disable colors (also honors NO_COLOR)
```

## Network & sessions

```bash
adler --concurrency 64 alice             # in-flight probes (default 32)
adler --max-rps 5 alice                  # cap total request rate
adler --proxy socks5://host:1080 alice   # single proxy for everything
adler --proxy-pool pool.toml alice       # per-site geo/IP-type routing
adler --sessions sessions.toml alice     # operator-supplied sessions
adler --tor alice                        # local Tor SOCKS proxy
adler --rotate-ua alice                  # rotate User-Agent per request
```

See [Access engine → Egress pool](/adler-docs/access-engine/#egress-pool-geo-routing)
for how `--proxy-pool` interacts with the registry's per-site `access`
policies, and [Access engine →
Sessions](/adler-docs/access-engine/#sessions-reach-login-walled-sites)
for the session TOML format.

For TLS-fingerprint-blocked sites, build with `--features impersonate`
(see [Access engine → TLS-fingerprint
impersonation](/adler-docs/access-engine/#tls-fingerprint-impersonation)).

## Browser & cache

```bash
adler --browser-backend local alice          # headless Chrome for bot-protected
adler --browser-backend browserbase alice    # Browserbase cloud session
adler --browser-budget 20 alice              # cap browser-routed probes (default 50)
adler --no-browser alice                     # off for this run

adler --escalation-budget 50 alice           # automatic escalation cap (default 30)
adler --no-escalation alice                  # cheap-path verdicts only

adler --no-cache alice                       # bypass the result cache
adler --cache-ttl 86400 alice                # custom TTL (default 3600 s)
adler --cache-clear                          # drop the cache
```

Cache lives at `~/.cache/adler/`. The browser backend and automatic
escalation are described in [Access engine → Browser backend](/adler-docs/access-engine/#browser-backend)
and [Access engine → Automatic escalation](/adler-docs/access-engine/#automatic-escalation).

## Batch & enrichment

```bash
adler --input users.txt                      # batch many usernames, grouped output
adler --watch alice                          # diff vs last run; new/removed
adler --watch --interval 3600 alice          # keep watching
adler --enrich alice                         # extract name/bio/avatar
adler --correlate alice                      # group accounts by signal overlap
adler --permute aggressive alice             # search spelling variants
adler --completions zsh > _adler             # shell completions
```

## Doctor

The registry's detection signals occasionally rot — a site changes its
response markup, or its known-present test account gets deleted. The
doctor probes both halves of every signal (a known-present user must
resolve to `Found`, a random nonsense user must not) and reports any
site whose detection no longer holds.

```bash
adler --doctor                              # check every site
adler --doctor --only github,gitlab         # subset
adler --doctor --fix --only patreon         # propose a corrected signature
adler --doctor --suggest-known-present      # find candidate users for stale entries
```

`--doctor --fix` diffs the present/absent responses and prints a paste-
ready signal you can drop into the registry (or a local override). A
nightly GitHub Action runs the doctor across the whole registry and flags
structural rot.
