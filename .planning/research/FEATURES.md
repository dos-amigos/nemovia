# Feature Landscape

**Domain:** Food festival (sagre) aggregator for Veneto, Italy
**Researched:** 2026-03-04

## Competitor Landscape Summary

The Italian sagre discovery space has these tiers:

1. **Legacy portals** (SoloSagre, EventieSagre, AssoSagre, VenetoSagre, TuttoFesta): Text-heavy listings, jQuery-era UX, basic province/date filters, no map or geolocalization, invasive ads. These are the incumbents Nemovia replaces.
2. **Modern-ish portals** (Sagritaly, Itinerari nel Gusto): Better visual design, some Leaflet map integration, but still catalog-style browsing without true proximity search.
3. **Direct competitor** (Sagriamo): Native mobile app + web, has geolocation-based "near me" discovery, map markers, online table reservations, food ordering. Strongest existing product but focused on vendor-side features (ordering/reservations) rather than discovery UX. Coverage appears nationwide but sparse.

**The gap Nemovia fills:** No existing product combines comprehensive Veneto coverage (multi-source aggregation), modern mobile-first UX, intelligent food-type filtering, and proximity-based map discovery. Sagriamo comes closest but relies on organizers self-listing rather than scraping.

---

## Table Stakes

Features users expect from any event discovery product in 2026. Missing = users leave.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Event listing with key details** (name, dates, location, description) | Basic information architecture. Every competitor has this. | Low | SagraCard component covers this |
| **Search by location** (province, city, or radius) | Users think spatially: "What's near me?" Every portal has at least province filter. | Medium | PostGIS `find_nearby_sagre` RPC handles radius queries |
| **Date filtering** ("this weekend", "today", date range) | Users think in time buckets, not calendar dates. Research confirms humans think in "tonight, this weekend, next week." | Low | Pre-built quick filters: Oggi, Questo Weekend, Prossima Settimana |
| **Interactive map view** | AllEvents, Sagriamo, Sagritaly all have maps. Users expect to see events spatially, not just as lists. | Medium | Leaflet + OSM with marker clustering |
| **List/map toggle** | Standard pattern in event apps. Users switch between browsing (list) and exploring (map). | Low | Single toggle in search view |
| **Mobile-responsive design** | 70%+ of target users (Laura checking Friday night on her phone) are mobile. Every modern app must be mobile-first. | Medium | Tailwind + mobile-first CSS. BottomNav pattern. |
| **"Near me" geolocation** | Browser geolocation is table stakes for any location-based discovery in 2026. Sagriamo and AllEvents both have it. | Low | `navigator.geolocation` + PostGIS radius query |
| **Event detail page** with practical info | Users need: address, dates/times, what food is served, how to get there. Every portal provides a detail view. | Medium | Include: description, dates, location, food tags, mini-map, directions link |
| **Google Maps directions link** | "Take me there" is a fundamental call-to-action for physical events. | Low | Deep link: `https://maps.google.com/?daddr={lat},{lng}` |
| **Share event link** (especially WhatsApp) | In Italy, WhatsApp is the primary messaging app. The user persona literally says "manda il link al marito su WhatsApp." Web Share API covers this natively. | Low | `navigator.share()` with fallback to copy-link. WhatsApp is dominant in Italy. |
| **Food/cuisine type indication** | Users want to know what food is served before they go. Even legacy portals categorize by food type (pesce, carne, funghi). | Low | LLM auto-tagging already planned. Display as pills/badges on cards. |
| **SEO-optimized pages** | Organic search is the primary acquisition channel. "Sagre Veneto questo weekend" must find Nemovia. | Medium | Dynamic meta tags, OG images, JSON-LD Event schema, sitemap |
| **Fast page loads** | Legacy competitors are slow (heavy ads, jQuery). Speed is a competitive advantage that doubles as table stakes in 2026. | Medium | Next.js SSR/SSG, image optimization, no ads |

---

## Differentiators

Features that set Nemovia apart. Not expected by users (competitors lack them), but create the "wow, this is better" moment.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Multi-source aggregation** (5+ sites) | No single portal has all sagre. Nemovia's core value is COMPLETENESS -- "all sagre in one place." Competitors rely on self-listing or single-source data. | High | Config-driven generic scraper. Deduplication is the hard part. |
| **LLM-enriched descriptions** | Legacy portals have minimal, often copy-pasted descriptions. Enriched, engaging 250-char descriptions in consistent tone make every sagra feel curated. | Medium | Gemini 2.5 Flash batch processing via cron |
| **Intelligent food-type tags** (LLM-classified) | No competitor offers reliable food-type filtering. Users can filter for "Pesce" or "Funghi" and get accurate results across all sources. | Medium | LLM auto-tagging. Normalize to ~15-20 canonical food categories. |
| **Proximity-sorted results with distance** | Show "3.2 km" or "15 km" next to each sagra. Legacy portals show province at best. Sagriamo does this but with limited coverage. | Low | PostGIS distance calculation, trivial once geolocation works |
| **Modern, premium UI** (animations, polish) | Every existing portal looks dated. A polished, animated UI is immediately differentiating. This is the "first 3 seconds" advantage. | Medium | Shadcn/UI + Magic UI + Framer Motion. Invest in micro-interactions. |
| **"This weekend" hero section** | Homepage immediately answers the #1 question: "What sagre are happening this weekend near me?" No competitor surfaces this prominently. | Low | Date-filtered query, geolocation optional, prominent on homepage |
| **Smart quick filters** | One-tap filters like "Gratis", "Pesce", "Questo weekend", "Entro 20km" that combine to answer real user intents. Competitors have clunky multi-step forms. | Medium | Combine as composable filter chips. Each filter is a query param. |
| **Cluster markers on map** | When zoomed out, group nearby sagre into numbered clusters. AllEvents does this. No Italian competitor does. Prevents map marker soup. | Low | Leaflet.markercluster plugin, well-established pattern |
| **Automatic event expiry** | Events disappear after their end date. Legacy portals are littered with past events, destroying trust. | Low | Cron job marks events as expired. Only show active/upcoming. |
| **Schema.org Event structured data** | Enables Google rich results ("sagra del baccala Sandrigo" shows date/location directly in Google). No Italian competitor does this well. | Low | JSON-LD on detail pages. Google explicitly supports Event schema. |
| **OG image per sagra** | When shared on WhatsApp/social, shows a rich preview with sagra name, date, food type. Makes shares look professional. | Medium | Dynamic OG image generation via Vercel OG or similar |

---

## Anti-Features

Features to explicitly NOT build. Each has a reason.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **User accounts / login** | Adds friction to a discovery-only app. Target user wants 30-second flow: open, find, share, go. Auth adds complexity with zero value for read-only use case. | Keep everything public and anonymous. Revisit only if adding favorites/notifications later. |
| **Reviews / ratings / comments** | Requires moderation, auth, and UGC management. Sagre are short-lived events (days, not permanent venues) -- reviews have minimal value. Creates legal/reputation risk with organizers. | Show factual info only: what, where, when, what food. Let Google Maps handle venue reviews. |
| **User-uploaded photos** | Storage costs, moderation burden, legal issues (photo rights). Scraped images from source sites are sufficient. | Use source images. If no image available, use a tasteful placeholder or food-category illustration. |
| **Table reservations / food ordering** | This is Sagriamo's territory and requires deep integration with each sagra's operations. Massive complexity for uncertain value. | Link to organizer's website/phone if reservation info is available. "Call to reserve" is sufficient. |
| **Ticket sales / payments** | Most sagre are free entry (pay for food). Ticketing adds payment processing, refunds, legal compliance. Not the product's focus. | Show "Gratis" / "Ingresso a pagamento" as a filter. Link to organizer for paid events. |
| **Gamification / badges / points** | Requires auth, adds complexity, unclear motivation for a utility app. Users want to find sagre, not collect badges. | Focus on utility: fast discovery, good information, easy sharing. |
| **Notifications / push alerts** | Requires auth + push infrastructure (service workers, VAPID keys, subscription management). Premature for MVP. | Show "Questo weekend" prominently on homepage. Users will return organically. Revisit as PWA feature post-MVP. |
| **Favorites / saved events** | Requires some form of persistence (auth or local storage). Local storage is fragile (cleared on browser cleanup). Auth is out of scope. | Share link is the "save" mechanism. WhatsApp message to self = bookmark. |
| **Multi-region expansion** | Tempting to go national, but dilutes the value prop. "All sagre in Veneto" is verifiable and defensible. "All sagre in Italy" is a data quality nightmare. | Stay Veneto-only for MVP. Nail coverage and quality for one region first. |
| **Native mobile app** | App store distribution adds friction (download, install, storage). PWA or responsive web app reaches more users faster with zero install friction. | Mobile-first responsive web. Consider PWA (add to home screen) as a lightweight enhancement post-MVP. |
| **AI chatbot / voice search** | Over-engineering for a discovery app. Users know what they want (sagre this weekend near me). Filters solve this faster than conversation. | Invest in excellent filter UX instead. Quick filters = faster than asking a chatbot. |
| **Vendor dashboard / organizer portal** | Building for organizers is a different product. Nemovia aggregates existing data; it does not need organizer cooperation. | Scrape public data. If organizers want to claim/update their listing, that is a v2+ feature. |
| **Advertising / sponsored listings** | Ads destroy the UX advantage over legacy portals. The entire competitive moat is "clean, fast, no-ads experience." | Validate product-market fit first. Monetization comes after proven traction. |

---

## Feature Dependencies

```
Geolocation (browser API)
  --> "Near me" search
  --> Proximity-sorted results with distance
  --> "This weekend near me" hero section

Scraping pipeline (Cheerio + cron)
  --> Event data in database
  --> LLM enrichment (depends on raw data)
    --> Food-type tags (depends on LLM)
      --> Food-type filter chips
    --> Enriched descriptions
  --> Geocoding (depends on city/address from scraping)
    --> Map markers (depends on coordinates)
    --> Proximity queries (depends on coordinates)
    --> Cluster markers (depends on map markers)

PostGIS setup
  --> Spatial queries (find_nearby_sagre)
  --> Distance calculation in results
  --> Radius filter

Search/filter system
  --> Province filter (basic DB query)
  --> Date filter (basic DB query)
  --> Food-type filter (depends on LLM tags)
  --> Free/paid filter (depends on scraping extracting price info)
  --> Radius filter (depends on PostGIS + geocoding)
  --> Combined quick filters (depends on all individual filters)

Event detail page
  --> SEO metadata (depends on detail page existing)
  --> Schema.org JSON-LD (depends on detail page)
  --> OG image generation (depends on detail page + event data)
  --> Share functionality (depends on detail page URL)
  --> Google Maps directions link (depends on coordinates)

Homepage
  --> Weekend sagre section (depends on date query)
  --> Hero with location awareness (depends on geolocation, optional)
  --> Quick filter chips (depends on search system)
```

---

## MVP Recommendation

**Prioritize (Phase 1 -- Core Discovery):**

1. Scraping pipeline with 3+ sources (foundation for everything)
2. Geocoding + PostGIS setup (enables map and proximity)
3. Event listing with cards (name, dates, city, food tags, distance)
4. Interactive map with clusters
5. Basic filters: province, date range, "this weekend"
6. "Near me" geolocation
7. Mobile-first responsive layout with BottomNav
8. Event detail page with directions link + share

**Prioritize (Phase 2 -- Enrichment + Polish):**

9. LLM auto-tagging for food types
10. LLM description enrichment
11. Food-type filter chips
12. "This weekend" hero section on homepage
13. Schema.org Event structured data
14. SEO metadata + sitemap
15. OG image generation per sagra
16. Combined quick filter chips
17. Premium animations (Framer Motion, Magic UI)

**Defer:**

- **Radius/km filter slider**: Nice but province + "near me" covers 90% of use cases. Add when basic filters are validated.
- **Free/paid filter**: Depends on price data being reliably scraped. Add when data quality is confirmed.
- **PWA (add to home screen)**: Post-MVP enhancement. Service worker + manifest. Low effort but not critical for validation.
- **Calendar integration (Add to Calendar)**: Minor convenience feature. `.ics` file download or Google Calendar deep link. Revisit post-MVP.
- **Dark mode**: Cosmetic. Not a priority for a daytime-use discovery app.

---

## Sources

### Competitor Sites (directly analyzed)
- [Solo Sagre](https://www.solosagre.it/) -- Legacy portal, text-heavy, basic filters
- [Eventi e Sagre](https://www.eventiesagre.it/) -- ~5,667 daily visitors, dated UX, jQuery-era
- [Sagritaly](https://sagritaly.com/) -- Most modern existing portal, Leaflet map integration
- [AssoSagre](https://www.assosagre.it/) -- National calendar, traditional listing format
- [VenetoSagre](http://www.venetosagre.it/) -- Veneto-specific, very dated, no map
- [TuttoFesta](https://www.tuttofesta.net/) -- National events portal
- [Sagriamo](https://www.sagriamo.it/) -- Closest competitor: native app, geolocation, ordering/reservations
- [Itinerari nel Gusto](https://www.itinerarinelgusto.it/sagre-e-feste/veneto) -- Regional focus, basic search

### Event Discovery Patterns
- [AllEvents 2026 Roadmap](https://allevents.in/blog/allevents-2026-event-discovery-roadmap/) -- Maps, personalization, friend planning
- [Google Event Schema Documentation](https://developers.google.com/search/docs/appearance/structured-data/event) -- Structured data requirements
- [Event Management App UI/UX Trends 2025](https://vocal.media/01/event-management-app-ui-ux-trends-that-are-winning-in-2025) -- Simplicity, gesture navigation, accessibility

### UX Research
- [Calendar UI Best Practices](https://www.eleken.co/blog-posts/calendar-ui) -- Time bucket thinking pattern
- [Filter UX Design Best Practices](https://lollypop.design/blog/2025/july/filter-ux-design/) -- Filter patterns for SaaS/discovery
- [PWA Guide 2025](https://isitdev.com/progressive-web-apps-pwa-guide-2025/) -- Offline, installability patterns
