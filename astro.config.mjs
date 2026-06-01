// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import remarkGfm from "remark-gfm";

// Adler documentation site. Hosted on Cloudflare Pages at
//   https://adler-docs.pages.dev/
// (and a future custom domain, e.g. https://docs.adler.dev).
// Cloudflare Pages serves at the project root, so no `base` prefix is
// needed — internal links use `/install/`, `/access-engine/`, etc.
export default defineConfig({
    site: "https://adler-docs.pages.dev",
    // Astro applies remark-gfm to .md files by default, but the MDX
    // integration does NOT inherit the default plugin list — so tables /
    // task lists / autolinks silently render as plain text in `.mdx`
    // pages (e.g. the compare table on the landing page). Adding it
    // here propagates GFM to both `.md` and `.mdx`.
    markdown: {
        remarkPlugins: [remarkGfm],
    },
    integrations: [
        starlight({
            // Caps, monospace, tracked out — the same brand mark the SPA
            // uses in its top-bar (`adler-server/web/src/styles.css`
            // `.logo-link`). The CSS in `src/styles/adler.css` enforces
            // the font / letter-spacing / colour to match exactly.
            title: "ADLER",
            description:
                "OSINT username search across ~3,000 sites — built for operators reaching Cloudflare-walled, TLS-fingerprinted, geo-restricted, login-walled sites.",
            // Match the SPA's design system (`adler-server/web/src/ui/tokens.css`):
            // pitch-black surface, red brand accent, 2 px corners, JetBrains
            // Mono + system sans. The empty ThemeSelect override hides the
            // light/dark switcher — the SPA is dark-only, the docs follow.
            customCss: ["./src/styles/adler.css"],
            components: {
                ThemeSelect: "./src/components/ThemeSelect.astro",
            },
            social: [
                {
                    icon: "github",
                    label: "GitHub",
                    href: "https://github.com/commit3296/adler",
                },
            ],
            editLink: {
                baseUrl:
                    "https://github.com/commit3296/adler-docs/edit/main/",
            },
            // PR-reviewable sidebar — links by slug so renames in
            // src/content/docs/ surface as build errors rather than
            // silent 404s.
            sidebar: [
                {
                    label: "Getting started",
                    items: [
                        { slug: "install" },
                        { slug: "quickstart" },
                    ],
                },
                {
                    label: "Guides",
                    items: [
                        { slug: "usage" },
                        { slug: "access-engine" },
                        { slug: "web-ui" },
                    ],
                },
                {
                    label: "Reference",
                    items: [
                        { slug: "embedding" },
                        { slug: "site-registry" },
                    ],
                },
                {
                    label: "Help",
                    items: [{ slug: "faq" }],
                },
            ],
            // Keep the footer terse — operators care about content,
            // not boilerplate.
            lastUpdated: true,
        }),
    ],
});
