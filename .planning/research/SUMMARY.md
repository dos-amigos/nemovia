# Research Summary: Nemovia

**Domain:** Food festival (sagre) aggregator web app
**Researched:** 2026-03-04
**Overall confidence:** HIGH

## Executive Summary

Nemovia is a web app that aggregates Italian food festivals (sagre) from 5+ websites in the Veneto region, enriches them with LLM-powered classification and descriptions, and presents them in a modern mobile-first UI with interactive maps and filters. The target user is someone who wants to find sagre for the weekend near them in under 30 seconds.

The team's pre-selected stack (Next.js, Supabase, Leaflet, Cheerio, Gemini, Vercel) is well-validated and appropriate for this use case. Research confirmed all choices are sound, but surfaced three critical corrections: (1) the `@google/generative-ai` npm package is deprecated -- use `@google/genai` instead, (2) Framer Motion has been renamed to `motion`, and (3) Vercel's free tier only supports daily cron jobs, so all scheduled work (scraping 2x/day, enrichment 2x/day) must use Supabase's pg_cron + Edge Functions instead.

The zero-budget constraint is achievable. All services fit within free tier limits for an MVP with a few thousand sagre records and moderate traffic. The main scaling bottleneck is the Gemini free tier (250 requests/day), but this is manageable by enriching only new sagre and combining multiple operations per request.

The architecture naturally splits into a frontend layer (Vercel) and a backend processing layer (Supabase Edge Functions + pg_cron). This separation is necessary because Vercel free tier has a 10-second function timeout, while scraping and LLM enrichment require longer-running processes that fit within Supabase Edge Functions' 150-second timeout.

## Key Findings

**Stack:** Next.js 15 + Tailwind v4 + shadcn/ui + Supabase (PostGIS + pg_cron) + Cheerio + Gemini 2.5 Flash + Leaflet + Vercel. All zero-cost, all production-ready.

**Architecture:** Frontend on Vercel (SSR, static, API routes), background processing on Supabase (Edge Functions for scraping/enrichment, pg_cron for scheduling, PostGIS for geo-queries).

**Critical pitfall:** Vercel free cron is daily-only; Gemini free tier is 250 RPD (not 2000 as assumed in PROJECT.md); Leaflet requires SSR-disabled dynamic imports in Next.js.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Foundation & Data Model** - Set up Next.js project, Supabase with PostGIS, define sagra schema with geography column, deploy to Vercel
   - Addresses: Project scaffolding, database design, deployment pipeline
   - Avoids: Building UI before data model is stable

2. **Scraping Pipeline** - Config-driven generic scraper with Cheerio, Supabase Edge Functions, pg_cron scheduling
   - Addresses: Automated data collection from 5+ sources
   - Avoids: Manual data entry, hardcoded scrapers

3. **LLM Enrichment** - Gemini 2.5 Flash integration for food tagging and description enrichment, geocoding with Nominatim
   - Addresses: Data quality, searchable food categories, coordinates for map
   - Avoids: Building map/search before data has coordinates and tags

4. **Core UI & Search** - Homepage, sagra cards, filter system, list/map toggle, mobile-first layout
   - Addresses: Primary user experience, discovery flow
   - Avoids: Premature animation polish before core UX works

5. **Interactive Map** - Leaflet integration, marker clustering, "near me" geolocation, detail page with mini-map
   - Addresses: Map-based discovery, location-aware search
   - Avoids: SSR issues by isolating map in client-only components

6. **Polish & SEO** - Animations (Motion, Magic UI), dynamic metadata, sitemap, OG images, sharing
   - Addresses: Premium feel, discoverability, social sharing
   - Avoids: Over-investing in polish before core features work

**Phase ordering rationale:**
- Data model must exist before scraping can populate it
- Scraping must run before LLM enrichment has data to process
- Enrichment (tags, coordinates) must complete before search/map can work meaningfully
- UI and map need real data to test properly
- Polish is last because it adds zero functional value

**Research flags for phases:**
- Phase 2 (Scraping): Likely needs deeper research on each target site's HTML structure and anti-scraping measures
- Phase 3 (LLM): Standard patterns, but monitor Gemini free tier limits closely -- they changed in Dec 2025 and could change again
- Phase 5 (Map): SSR workarounds are well-documented but tricky; follow the dynamic import pattern exactly

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies verified via official docs and npm. Versions confirmed current. |
| Features | HIGH | Standard aggregator patterns, well-understood domain. |
| Architecture | HIGH | Vercel + Supabase separation is a proven pattern with extensive documentation. |
| Pitfalls | HIGH | Vercel cron, Gemini limits, Leaflet SSR are well-documented issues with known solutions. |

## Gaps to Address

- **Target site HTML structure:** Need to inspect each of the 5 sagre websites to confirm they're static HTML (suitable for Cheerio) and identify CSS selectors
- **Gemini free tier stability:** Google quietly changed limits in Dec 2025. Monitor for further changes.
- **Supabase free tier pausing:** Projects pause after 7 days of inactivity. pg_cron activity should prevent this, but needs verification.
- **Italian date format parsing:** Sagre sites use various Italian date formats ("15-17 Agosto 2026", "dal 15 al 17 agosto"). Need date-fns Italian locale + custom parsers.
- **Image handling:** Scraped images may be hotlinked (blocked by CORS/referrer) or low quality. May need Supabase Storage for caching images.
