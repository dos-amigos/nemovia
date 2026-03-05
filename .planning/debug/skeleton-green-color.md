---
status: awaiting_human_verify
trigger: "Investigate why loading skeletons are green instead of neutral gray on the Nemovia app."
created: 2026-03-05T00:00:00Z
updated: 2026-03-05T00:10:00Z
symptoms_prefilled: true
---

## Current Focus

hypothesis: CONFIRMED - Fix applied, awaiting human verification
test: changed bg-accent to bg-muted in skeleton.tsx
expecting: neutral gray skeletons with pulsing animation
next_action: human verification required

## Symptoms

expected: Gray/neutral pulsing skeleton placeholders (standard shadcn Skeleton behavior with bg-muted and animate-pulse)
actual: On /cerca and /mappa, loading skeletons are green (full color) instead of gray. On homepage, white page then brief green flash instead of skeleton placeholders.
errors: None reported (visual issue only)
reproduction: Navigate to /cerca, /mappa, or homepage and observe loading state
started: Unknown (user reported issue)

## Eliminated

## Evidence

- timestamp: 2026-03-05T00:05:00Z
  checked: src/components/ui/skeleton.tsx line 7
  found: className uses "bg-accent" instead of standard shadcn "bg-muted"
  implication: accent color is being used for skeleton background

- timestamp: 2026-03-05T00:06:00Z
  checked: src/app/globals.css line 29
  found: --accent is defined as oklch(0.527 0.154 150.069) which is green-700
  implication: bg-accent renders as green, explaining the green skeletons

- timestamp: 2026-03-05T00:07:00Z
  checked: src/app/globals.css line 26
  found: --muted is defined as oklch(0.970 0.001 106.424) which is stone-100 (neutral gray)
  implication: bg-muted would provide the correct neutral gray skeleton appearance

- timestamp: 2026-03-05T00:08:00Z
  checked: all loading.tsx files (homepage, cerca, mappa) and SagraCardSkeleton.tsx
  found: all use the Skeleton component correctly, no override classes
  implication: issue is centralized in skeleton.tsx component only - single point fix

## Resolution

root_cause: The Skeleton component in src/components/ui/skeleton.tsx uses bg-accent class instead of bg-muted. The theme defines accent as green-700 (oklch(0.527 0.154 150.069)), causing all skeletons to render green instead of the standard neutral gray.
fix: Changed className from "bg-accent" to "bg-muted" in skeleton.tsx line 7
verification: Fix applied - changed background class to use muted color (stone-100) which provides neutral gray appearance. All skeleton instances (homepage, cerca, mappa, card skeletons) will now display as gray with pulsing animation.
files_changed: ["src/components/ui/skeleton.tsx"]
