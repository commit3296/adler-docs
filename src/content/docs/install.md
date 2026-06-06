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

`adler --version` <span class="since-chip">since v0.11.4</span> prints
the crate version plus build provenance (short git SHA, target triple,
opt-in feature flags). Include the multi-line output verbatim in bug
reports so the maintainer doesn't have to ask which build you have:

```text
adler 0.13.0
commit:   4ad5db8e5723
target:   x86_64-unknown-linux-gnu
features: <default>
```

`-V` keeps the one-line form for scripts.

## Verifying release archives (Sigstore cosign)

Every platform archive attached to a GitHub Release
<span class="since-chip">since v0.11.4</span> ships with a matching
`.sig` (Sigstore signature) and `.pem` (Fulcio certificate). Signing
is keyless — no long-lived key in repo secrets — backed by the
workflow's OIDC token, exchanged for a short-lived certificate bound
to `release.yml@<release-tag>`. Verification recipe:

```bash
TAG=v0.13.0                                  # or whichever release
ARCHIVE=adler-x86_64-unknown-linux-gnu.tar.gz

# Pull the archive + signature + certificate from the release.
gh release download "$TAG" --repo commit3296/adler \
  --pattern "$ARCHIVE" --pattern "$ARCHIVE.sig" --pattern "$ARCHIVE.pem"

# Verify the signature is bound to this repo's release.yml workflow.
cosign verify-blob \
  --certificate "$ARCHIVE.pem" \
  --signature   "$ARCHIVE.sig" \
  --certificate-identity-regexp '^https://github\.com/commit3296/adler/\.github/workflows/release\.yml@refs/tags/v[0-9]+\.[0-9]+\.[0-9]+' \
  --certificate-oidc-issuer 'https://token.actions.githubusercontent.com' \
  "$ARCHIVE"
```

A successful verification prints `Verified OK`. The identity-regex
pins the signer to *this* repository's `release.yml` at a SemVer tag
— a forged archive uploaded under a different workflow won't satisfy
it.

## For distro packagers

`adler --man-page` <span class="since-chip">since v0.11.4</span> prints
a roff(1) man page generated from the same clap definition that
drives `--help`, so there's no hand-maintained `.1` file to fall out
of sync. Pipe it straight into the package's man path:

```bash
adler --man-page > /usr/share/man/man1/adler.1
```

The page comes out as one OPTIONS block; help-group subsections
documented in `--help` are a clap-mangen upstream limitation.
