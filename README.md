# adler-docs

User-facing documentation for [Adler](https://github.com/commit3296/adler),
an OSINT username-search tool. Built with [Astro
Starlight](https://starlight.astro.build/) and deployed to GitHub Pages
at <https://commit3296.github.io/adler-docs/>.

The `adler` Rust API reference lives on
[docs.rs](https://docs.rs/adler-core); this site covers the user-facing
manual (installation, the access engine, the web UI, embedding,
troubleshooting).

## Repository layout

```
.
├── public/                       # static assets served verbatim
├── src/
│   ├── assets/                   # images embedded via Markdown
│   ├── content/docs/             # the actual pages, slugs map to URLs
│   │   ├── index.mdx
│   │   ├── install.md
│   │   ├── quickstart.md
│   │   ├── usage.md
│   │   ├── access-engine.md
│   │   ├── web-ui.md
│   │   ├── embedding.md
│   │   ├── site-registry.md
│   │   └── faq.md
│   └── content.config.ts
├── astro.config.mjs              # sidebar + site / base path config
└── .github/workflows/deploy.yml  # GH Pages build + deploy on push
```

## Local development

```bash
npm ci
npm run dev      # http://localhost:4321/adler-docs/
npm run build    # produces dist/
npm run preview  # serve dist/ for a final sanity-check before push
```

## Contributing

Spotted a typo or want to expand a guide? PRs welcome. Each Starlight
page has an "Edit this page" link in the footer that takes you to the
right file on GitHub.

For larger structural changes (new sections, sidebar reshuffles), open
an issue on the main [`adler`](https://github.com/commit3296/adler)
repo first so we can align on scope.

## License

MIT, same as the main Adler project.
