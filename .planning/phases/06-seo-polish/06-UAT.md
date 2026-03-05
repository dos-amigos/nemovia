---
status: complete
phase: 06-seo-polish
source: 06-01-SUMMARY.md, 06-02-SUMMARY.md, 06-03-SUMMARY.md
started: 2026-03-05T15:10:00Z
updated: 2026-03-05T15:15:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Page Title Branding
expected: Open the app in your browser. Navigate to the homepage — the browser tab should show "Nemovia - Sagre del Veneto". Navigate to /cerca — tab should show "Cerca Sagre | Nemovia". Navigate to /mappa — tab should show "Mappa | Nemovia". Open any sagra detail page — tab should show the sagra name followed by "| Nemovia".
result: skipped
reason: No sagre in database — detail page title not testable. Static pages (home/cerca/mappa) need user confirmation.

### 2. robots.txt
expected: Visit /robots.txt in the browser. You should see plain text with "User-Agent: *", "Allow: /", and a Sitemap line pointing to your domain's /sitemap.xml.
result: pass

### 3. Dynamic Sitemap
expected: Visit /sitemap.xml in the browser. You should see an XML document listing URLs for the homepage, /cerca, /mappa, and individual sagra detail pages (one <url> entry per active sagra in the database).
result: pass

### 4. OG Image Generation
expected: Pick any sagra detail page (e.g. /sagra/some-slug). Append /opengraph-image to the URL (e.g. /sagra/some-slug/opengraph-image). You should see a 1200x630 branded image card with the sagra title, location, dates, and an amber-to-green gradient background.
result: skipped
reason: No sagre in database — no detail page accessible to test OG image generation.

### 5. Loading Skeletons
expected: Open DevTools → Network tab → set throttling to "Slow 3G". Navigate to the homepage — you should see gray pulsing placeholder shapes (skeleton) for hero, filters, weekend, and province sections before real content loads. Do the same for /cerca, /mappa, and a sagra detail page — each should show route-appropriate skeleton placeholders.
result: issue
reported: "con il 3G impostato in throttling vedo solo pagina bianca, poi vedo per una frazione di secondo dei blocchi verdi che spariscono subito, poi vedo bianco, nessun placeholder pulsing. UPDATE: su cerca e mappa lo skeleton è visibile ma è verde pieno invece che grigio chiaro pulsing."
severity: cosmetic

### 6. Empty State (Search)
expected: Go to /cerca and apply filters that match no sagre (e.g. an impossible combination). Instead of a blank area, you should see a centered icon (magnifying glass), a title like "Nessun risultato", and a helpful description message.
result: pass

### 7. Scroll Animations (Homepage)
expected: Open the homepage and scroll down. Each section (Hero, Quick Filters, Weekend, Provinces) should fade-in-up smoothly as it enters the viewport. The animations should cascade with slight delays between sections (Hero first, then Filters, Weekend, Provinces). Scrolling back up should NOT replay the animations — they fire once.
result: pass

### 8. Staggered Card Grid Animation
expected: View any page that shows a grid of sagra cards (homepage or search results). The cards should appear one-by-one with a spring animation (slight bounce/settle), not all at once. There should be a visible stagger — each card appears ~80ms after the previous one.
result: skipped
reason: No sagre in database — no cards to display.

### 9. Detail Page Progressive Animation
expected: Open any sagra detail page. The content sections should reveal progressively — title/hero area first, then description, then tags/info, then map section — each with a smooth fade-in-up animation with increasing delays.
result: skipped
reason: No sagre in database — no detail page accessible.

## Summary

total: 9
passed: 4
issues: 1
pending: 0
skipped: 4

## Gaps

- truth: "Loading skeletons show gray pulsing placeholders during data fetch on all routes"
  status: failed
  reason: "User reported: skeletons are green instead of gray on cerca/mappa. Homepage shows white page then brief green flash. Skeletons should be neutral gray with pulsing animation."
  severity: cosmetic
  test: 5
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
