// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

// Adler documentation site. Hosted on GitHub Pages at
//   https://commit3296.github.io/adler-docs/
// so we have to set both `site` and `base` — Starlight uses them to
// resolve internal links, the search index, and the Edit-this-page URL.
export default defineConfig({
    site: "https://commit3296.github.io",
    base: "/adler-docs",
    integrations: [
        starlight({
            title: "Adler",
            description:
                "OSINT username search across ~3,000 sites — built for operators reaching Cloudflare-walled, TLS-fingerprinted, geo-restricted, login-walled sites.",
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
