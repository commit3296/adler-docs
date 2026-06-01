---
title: Embedding (Rust library)
description: Drive adler-core from your own Rust code — minimal worked example plus the notable builder knobs and per-site fields you'll actually touch.
---

<p class="audience-badge audience-embedder">For embedders · Rust</p>

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
adler-core = "0.10"
tokio = { version = "1", features = ["macros", "rt-multi-thread"] }
```

To opt into the TLS-fingerprint impersonation transport, enable the
`impersonate` feature (build-time deps: `cmake`, a C++ compiler,
`libclang` — see [Access engine → TLS-fingerprint impersonation](/access-engine/#tls-fingerprint-impersonation)):

```toml
[dependencies]
adler-core = { version = "0.10", features = ["impersonate"] }
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

## Outcome telemetry

Every `CheckOutcome` carries `transport` (`http` / `impersonate` /
`browser`) and `escalations` (usually `0`, `1` when the cheap path was
retried through the browser). Persisted scans saved before these fields
existed still deserialise — both are `Option`/`u8` with serde defaults.

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

Each change has a migration block in
[the CHANGELOG](https://github.com/commit3296/adler/blob/main/CHANGELOG.md).
