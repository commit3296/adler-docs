<!--
Thanks for sending a docs PR.

A few quick notes before you hit Create:

1. Every push (including this branch) gets a Cloudflare Pages preview
   deployment. Once it's up, the URL appears as a check on the PR — please
   open it and skim the affected pages in a browser before requesting
   review.

2. If this PR changes the rendered look (CSS, new component, image), drop
   a screenshot or short clip below — much faster to review than a diff.

3. Internal links use Starlight's slugified routes (`/access-engine/`,
   `/glossary/#term-name`), not file paths. The lychee CI job checks
   external links; Astro's build catches broken internal links.
-->

## Summary

<!-- One or two sentences: what changed and why. -->

## Affected pages

<!-- Slugs or file paths, e.g. `/access-engine/`, `/embedding/`. -->

## Screenshots / visual diff

<!-- If the visual output changed: drop a before/after screenshot here.
     Otherwise: "no visual change". -->

## Checklist

- [ ] `npm run build` passes locally.
- [ ] CF Pages preview deploy succeeded (check appears on the PR).
- [ ] Affected pages skim-read in the preview deployment.
- [ ] Any new internal cross-link uses the Starlight slug form, not a
      relative `.md` path.
- [ ] If introducing a new page, it's added to the sidebar in
      `astro.config.mjs` and tagged with the right audience badge +
      Diátaxis type chip.
