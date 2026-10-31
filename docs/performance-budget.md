# Performance budget

Lighthouse measures each page as if on a mid-range phone with a slow 4G connection (CPU slowed 4×). Scores are out of 100. The budget is the line a change must not cross; a page that falls below it gets fixed before release.

## Budget

| Measure | Budget | Why |
| --- | --- | --- |
| Accessibility | 95 or more | Every shopper must be able to buy, including with a screen reader or keyboard |
| Best practices | 100 | HTTPS, no console errors, no deprecated APIs |
| SEO | 100 | Storefronts must be findable |
| Performance | 70 or more on every storefront page | Slow stores lose sales |
| Layout shift (CLS) | under 0.1 | Nothing jumps while the page loads |
| Largest content shown (LCP) | under 4.0 s on the simulated phone | Google's "needs improvement" line is 4 s |

## Measured (2026-10-30, local production build)

| Page | Performance | Accessibility | Best practices | SEO | LCP | CLS | Blocking time |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Northbrew home (Classic) | 78 | 100 | 100 | 100 | 4.0 s | 0 | 370 ms |
| Lumen home (Bold) | 81 | 100 | 100 | 100 | 3.3 s | 0 | 450 ms |
| Product page | 72 | 100 | 100 | 100 | 3.3 s | 0 | 920 ms |
| Lumen product listing | 85 | 98 → fixed* | 100 | 100 | 3.7 s | 0 | 240 ms |

\* The listing lost two points because product titles skipped a heading level (h1 → h3). They are now h2.

Fixed during this pass: a missing `robots.txt` (SEO 92 → 100) and two low-contrast text styles on checkout found by the axe tests.

## What holds performance back, and the plan

- **JavaScript start-up on a slow phone.** Most "blocking time" is React starting up the interactive parts of the page (cart button, variant picker, menu). Next step: check that the large client chunk only holds what the storefront needs.
- **Big hero pictures.** They're already resized and served as WebP through `next/image`, and the first one loads with priority. In Phase 6 a CDN will serve them from close to the shopper, which shortens LCP the most.
- **No caching yet.** Every page is built on each request (needed for the per-request security nonce). Caching the catalogue data per store is a Phase 6 option once real traffic shows where it matters.

## How to measure

```bash
npm run build
```

```bash
npx next start -p 3211
```

```bash
npx lighthouse@13.6.0 http://localhost:3211/s/northbrew --only-categories=performance,accessibility,best-practices,seo --view
```

Run each page twice and take the second result: the first request after starting the server is slower because nothing is warmed up yet.
