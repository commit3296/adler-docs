---
title: Embedding (Rust library)
description: Drive adler-core from your own Rust code — minimal worked example plus the notable builder knobs and per-site fields you'll actually touch.
---

<p class="audience-badge audience-embedder">For embedders · Rust</p>
<span class="type-chip type-howto">How-to</span>

<aside class="tldr">

- **Rust:** add `adler-core = "0.15"`, build a `Client`, call `executor::run` — minimal example below.
- **Other languages:** shell out to `adler --format ndjson <username>` and parse one outcome per line. Python / Go / Node examples in [Driving Adler from other languages](#driving-adler-from-other-languages).
- **Knobs you'll actually touch:** `Client::builder()` (timeout, retries, browser, escalation), `Registry::filter` (tags / regex), `Site::access` (egress / session policy).
- **Telemetry:** every `CheckOutcome` carries `transport`, `escalations`, `evidence`, `profile_evidence`, and `confidence` — preserve them through your pipeline so consumers can explain why a result was trusted.

</aside>

`adler-core` is the runtime-agnostic engine that powers the CLI; it's
published separately on [crates.io](https://crates.io/crates/adler-core)
so you can embed username detection in your own Rust tools — a Discord
bot that checks usernames, a security tool that flags exposed identities
across a watchlist, a CI gate that asserts a name isn't claimed
elsewhere.

The [full API reference](https://docs.rs/adler-core) lives on docs.rs;
this page covers the worked example and the notable knobs.

## Adding the dependency

```toml
[dependencies]
adler-core = "0.15"
tokio = { version = "1", features = ["macros", "rt-multi-thread"] }
```

To opt into the TLS-fingerprint impersonation transport, enable the
`impersonate` feature (build-time deps: `cmake`, a C++ compiler,
`libclang` — see [Access engine → TLS-fingerprint impersonation](/access-engine/#tls-fingerprint-impersonation)):

```toml
[dependencies]
adler-core = { version = "0.15", features = ["impersonate"] }
```

## Minimal worked example

Load the embedded registry, scan one username, print the hits:

```rust
use adler_core::{Client, ExecutorOptions, MatchKind, Registry, Username, executor};

#[tokio::main]
async fn main() -> adler_core::Result<()> {
    let registry = Registry::default_embedded()?;
    // filter(include, exclude, tags, exclude_tags, include_nsfw)
    // — empty slices = no name/tag filter; `false` keeps the
    // default NSFW auto-exclusion.
    let sites = registry.filter(&[], &[], &[], &[], false);
    let username = Username::new("torvalds")?;
    let client = Client::builder().build()?;

    let outcomes = executor::run(
        &client, &sites, &username, ExecutorOptions::default(),
    ).await;

    for outcome in outcomes.iter().filter(|o| o.kind == MatchKind::Found) {
        println!("found: {} → {}", outcome.site, outcome.url);
    }
    Ok(())
}
```

## Driving Adler from other languages

`adler-core` is Rust-only on crates.io, but the CLI emits NDJSON — one
JSON outcome per line, flushed as each probe resolves. Any language with
a subprocess API can stream that, which is the recommended bridge for
Python / Go / Node embedders. Shape per line:

```json
{"site":"GitHub","kind":"found","transport":"http","escalations":0,"url":"https://github.com/torvalds","elapsed_ms":124,"confidence":{"score":85,"label":"high","reasons":[{"kind":"found_by_signal"}]}}
{"site":"Reddit","kind":"uncertain","reason":"cloudflare_challenge","transport":"http","escalations":0,"elapsed_ms":410}
```

The CLI exits `0` if any site resolved `Found`, `1` if none did, `2` on
error. Honour those rather than parsing stderr.

### Python

```python
import json
import subprocess

def scan(username: str):
    proc = subprocess.Popen(
        ["adler", "--format", "ndjson", username],
        stdout=subprocess.PIPE,
        text=True,
    )
    assert proc.stdout is not None
    for line in proc.stdout:
        line = line.strip()
        if not line:
            continue
        yield json.loads(line)
    proc.wait()
    if proc.returncode == 2:
        raise RuntimeError("adler exited with error")

for outcome in scan("torvalds"):
    if outcome["kind"] == "found":
        print(f"{outcome['site']}: {outcome['url']}")
    elif outcome["kind"] == "uncertain":
        print(f"{outcome['site']}: uncertain ({outcome['reason']})")
```

### Go

```go
package main

import (
    "bufio"
    "encoding/json"
    "fmt"
    "log"
    "os/exec"
)

type Outcome struct {
    Site         string `json:"site"`
    Kind         string `json:"kind"`
    Reason       string `json:"reason,omitempty"`
    Transport    string `json:"transport,omitempty"`
    Escalations  int    `json:"escalations,omitempty"`
    URL          string `json:"url,omitempty"`
    ElapsedMs    int    `json:"elapsed_ms"`
}

func main() {
    cmd := exec.Command("adler", "--format", "ndjson", "torvalds")
    stdout, err := cmd.StdoutPipe()
    if err != nil {
        log.Fatal(err)
    }
    if err := cmd.Start(); err != nil {
        log.Fatal(err)
    }
    scanner := bufio.NewScanner(stdout)
    for scanner.Scan() {
        var o Outcome
        if err := json.Unmarshal(scanner.Bytes(), &o); err != nil {
            continue
        }
        if o.Kind == "found" {
            fmt.Printf("%s: %s\n", o.Site, o.URL)
        }
    }
    _ = cmd.Wait()
}
```

### Node.js

```javascript
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

async function* scan(username) {
    const child = spawn("adler", ["--format", "ndjson", username]);
    const rl = createInterface({ input: child.stdout, crlfDelay: Infinity });
    for await (const line of rl) {
        if (!line.trim()) continue;
        yield JSON.parse(line);
    }
    await new Promise((resolve) => child.on("close", resolve));
}

for await (const o of scan("torvalds")) {
    if (o.kind === "found") {
        console.log(`${o.site}: ${o.url}`);
    } else if (o.kind === "uncertain") {
        console.log(`${o.site}: uncertain (${o.reason})`);
    }
}
```

The same NDJSON shape comes out of the `POST /api/scan` SSE stream from
`adler --web` — useful if you'd rather drive Adler over HTTP than as a
subprocess (see [Web UI → JSON API](/web-ui/#json-api)).

## Notable knobs

| | |
|---|---|
| `Client::builder()` | timeout, redirect policy, user-agent rotation, proxy, retry, rotate-UA, throttle, cache, browser backend, NSFW gate, escalation budget. |
| `ClientBuilder::egress_pool` | configure the geo / IP-type proxy pool. |
| `ClientBuilder::sessions` | supply operator-supplied `SessionStore` for login-walled sites. |
| `ClientBuilder::escalation_budget` / `disable_escalation` | cap or disable automatic escalation to the browser on `Uncertain(cloudflare_challenge | rate_limited)`. |
| `Client::with_egress_subset(&[name])` | cheap-clone the client with only the named egresses (shares budgets / sessions / throttle with the parent). |
| `Client::egress_summary` / `Client::session_names` | read-only views the web UI surfaces in `GET /api/access`. URLs and header values stay private. |
| `Registry::filter` | include/exclude by name substring, tag, `nsfw` opt-in (the 5th `include_nsfw: bool` parameter — pass `true` to scan adult sites). |
| `Site::request_headers` | per-site HTTP headers (e.g. Instagram's `X-IG-App-ID`); browser backends apply via `Network.setExtraHTTPHeaders`. |
| `Site::regex_check` | per-site username-validity regex. Mismatched usernames short-circuit to `Uncertain(UsernameNotAllowed)` without a network request. |
| `Site::known_present` | `KnownPresent::Single(String)` or `KnownPresent::Multiple(Vec<String>)`; `--doctor` passes if **any** declared username resolves to `Found`. |
| `BrowserBackend` trait | route bot-protected sites through real Chrome. Built-in: `LocalBackend` (chromiumoxide) and `BrowserbaseBackend` (cloud CDP). |
| `CheckOutcome.transport` / `escalations` | telemetry — which transport produced the verdict, how many escalations happened. |
| `CheckOutcome.evidence` / `profile_evidence` / `confidence` | explainability payload: signal evidence, normalized profile facts, and machine-readable confidence reasons. |
| `build_identity_clusters(username, outcomes)` | deterministic account grouping from structured profile evidence; never merges on username alone. |
| `InvestigationReportBuilder` | case-level report model that combines summary, found accounts, high-confidence accounts, evidence table, identity clusters, timeline, and limitations. See [Investigation reports](/investigation-reports/). |
| `avatar_hash_from_bytes` / `fetch_avatar_hash` | opt-in avatar perceptual hash helpers; callers must decide when external avatar fetching is appropriate. |

## Outcome telemetry

Every `CheckOutcome` carries `transport` (`http` / `impersonate` /
`browser`) and `escalations` (usually `0`, `1` when the cheap path was
retried through the browser), plus signal `evidence`, normalized
`profile_evidence`, and a `confidence` score with machine-readable
reasons. Persisted scans saved before these fields existed still
deserialise because newly added fields use serde-compatible defaults.

`profile_evidence` is deliberately narrower than arbitrary page
content: display names, bios, avatar URLs / avatar hashes, external
links, locations, joined dates, titles, descriptions, and strict
username-confirmation facts. Evidence source metadata records
non-secret provenance such as transport and whether authenticated access
was used; it does not store session names, cookie/header values, proxy
URLs, or egress names.

Identity clustering is a separate deterministic layer. Build clusters
from `Found` outcomes with structured profile evidence, treat
`uncertain: true` clusters as weak/supporting leads, and do not merge
accounts on username alone.

## Breaking changes by version

Pre-1.0 SemVer.

- **0.2.0** — `Site::request_headers` (`BTreeMap<String, String>`);
  `BrowserBackend::fetch` gained the `headers` parameter; `browser`
  module became `pub`.
- **0.3.0** — `Site::known_present` changed from `Option<String>` to
  `Option<KnownPresent>`; `DoctorReport::Healthy::present` and
  `Unhealthy::present` changed from `Option<CheckOutcome>` to
  `Vec<(String, CheckOutcome)>`.
- **0.4.0** — `Registry::filter` gained a fifth `include_nsfw: bool`
  parameter; `UncertainReason` gained `UsernameNotAllowed`;
  `Site::regex_check` field added.
- **0.9.0** — `AccessPolicy` introduced; `UncertainReason::GeoUnavailable`;
  `Client::egress_pool` builder method.
- **0.10.0** — `AccessPolicy.session`; `UncertainReason::SessionRequired`;
  `Client::sessions`; `TransportTier` enum + `CheckOutcome.transport` /
  `escalations` fields (serde-default — old scans deserialise unchanged);
  `EscalationBudget` + `ClientBuilder::escalation_budget` /
  `disable_escalation`.
- **0.12.0–0.15.0** — explainability and case-file models landed:
  `ProfileEvidence`, `EvidenceSource` access metadata, `ConfidenceScore`,
  `IdentityCluster`, `InvestigationReport`, strict username evidence from
  `body_username` signals, historical-confidence overlays, and opt-in
  avatar-hash evidence. These are additive serde shapes; older persisted
  scans still load and derive missing confidence / clusters at read time.

Each change has a migration block in
[the CHANGELOG](https://github.com/commit3296/adler/blob/main/CHANGELOG.md).
