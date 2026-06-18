# adler-docs

[![Cloudflare Pages](https://img.shields.io/badge/cloudflare%20pages-adler--docs.pages.dev-orange?logo=cloudflarepages&logoColor=white)](https://adler-docs.pages.dev/)
[![Links](https://github.com/commit3296/adler-docs/actions/workflows/links.yml/badge.svg)](https://github.com/commit3296/adler-docs/actions/workflows/links.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

User-facing documentation for [Adler](https://github.com/commit3296/adler),
an OSINT username-search tool. Built with [Astro
Starlight](https://starlight.astro.build/) and deployed to **Cloudflare
Pages** at <https://adler-docs.pages.dev/>.

The `adler` Rust API reference lives on
[docs.rs](https://docs.rs/adler-core); this site covers the user-facing
manual (installation, the access engine, the web UI, embedding,
investigation reports, troubleshooting).

## Repository layout

```
.
├── public/                       # static assets served verbatim
├── src/
│   ├── components/
│   │   └── ThemeSelect.astro     # empty override → hides theme switcher
│   ├── content/docs/             # the actual pages, slugs map to URLs
│   │   ├── index.mdx
│   │   ├── install.md
│   │   ├── quickstart.md
│   │   ├── first-scan.md
│   │   ├── usage.md
│   │   ├── access-engine.md
│   │   ├── web-ui.md
│   │   ├── investigation-reports.md
│   │   ├── embedding.md
│   │   ├── site-registry.md
│   │   └── faq.md
│   ├── styles/
│   │   └── adler.css             # Starlight var overrides → SPA theme
│   └── content.config.ts
├── astro.config.mjs              # sidebar + site config
├── .nvmrc                        # Node 22 — Astro 6.x minimum
└── package.json
```

## Local development

```bash
npm ci
npm run dev      # http://localhost:4321/
npm run build    # produces dist/
npm run preview  # serve dist/ for a final sanity-check before push
```

## Content priorities

Keep the first-user path current with the shipped Adler binary:

1. Install the binary and verify it.
2. Run a small explained scan.
3. Read verdicts, confidence, signal evidence, and profile evidence.
4. Use enrichment / Web UI when identity clusters or report exports
   matter.
5. Export finished scans as Markdown, JSON, or HTML investigation
   reports for handoff.

When the Web UI changes, update `public/screenshots/` and
`SCREENSHOTS.md` in the same PR as the affected guide text.

## Deploy

Cloudflare Pages owns build + deploy. Settings:

| Setting               | Value                |
| --------------------- | -------------------- |
| Production branch     | `main`               |
| Framework preset      | Astro                |
| Build command         | `npm run build`      |
| Build output directory| `dist`               |
| Node version          | `22` (`.nvmrc`)      |

Every push to `main` triggers a production build; every PR gets a
preview deployment with its own URL — so doc changes can be reviewed
visually before merge.

## Contributing

Spotted a typo or want to expand a guide? PRs welcome. Each Starlight
page has an "Edit this page" link in the footer that takes you to the
right file on GitHub.

For larger structural changes (new sections, sidebar reshuffles), open
an issue on the main [`adler`](https://github.com/commit3296/adler)
repo first so we can align on scope.

## License

MIT, same as the main Adler project.
