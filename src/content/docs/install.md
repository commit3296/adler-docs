---
title: Install
description: cargo binstall, cargo install, build from source.
---

<p class="audience-badge audience-operator">For operators · running scans</p>
<span class="type-chip type-howto">How-to</span>

## From `cargo binstall` (recommended)

Pre-built binary from the GitHub release — instant, no compile:

```bash
cargo binstall adler-cli            # https://github.com/cargo-bins/cargo-binstall
```

`cargo binstall` ships impersonate-enabled binaries on x86_64-linux,
both macOS targets, and Windows. The `aarch64-unknown-linux-gnu` build
ships *without* the impersonate feature — see [TLS-fingerprint
impersonation](/access-engine/#tls-fingerprint-impersonation)
for why and how to opt back in.

## From source (`cargo install`)

Compiles locally; ~1–2 min on a recent machine:

```bash
cargo install adler-cli
```

To include TLS-fingerprint impersonation (needed for sites tagged
`protection: tls-fingerprint`):

```bash
cargo install adler-cli --features impersonate
```

The feature pulls in BoringSSL and needs `cmake`, a C++ compiler, and
`libclang` at build time:

- Fedora: `sudo dnf install cmake gcc-c++ clang`
- Debian / Ubuntu: `sudo apt install cmake clang libclang-dev`
- macOS: `brew install cmake` (clang ships with the developer tools)
- Windows: install the LLVM toolchain; the build script reads `LIBCLANG_PATH`

## From the repository

```bash
git clone https://github.com/commit3296/adler.git
cd adler
cargo install --path adler-cli
```

## Requirements

- **Rust ≥ 1.85** for compiling from source.
- For `--browser-backend local`: Chrome or Chromium reachable on `PATH`.
- For `--browser-backend browserbase`: `ADLER_BROWSERBASE_API_KEY` and
  `ADLER_BROWSERBASE_PROJECT_ID` environment variables; see
  [Access engine → Browser backend](/access-engine/#browser-backend).

## What ships

The installed binary is `adler`. The library
([`adler-core`](https://crates.io/crates/adler-core)) is published
separately for embedding the engine in your own tools — see
[Embedding](/embedding/).

| Crate         | Kind | Purpose                                                  |
| ------------- | ---- | -------------------------------------------------------- |
| `adler-core`  | lib  | Detection engine, site registry, executor.               |
| `adler-server`| lib  | HTTP API + SSE streaming + scan persistence; embeds the SolidJS web UI via `rust-embed`. |
| `adler-cli`   | bin  | `adler` command-line interface; `--web` launches the embedded server + UI in-process. |

## Verifying the install

```bash
adler --version
adler --doctor --only github   # quick check against a known signature
```
