# Design: Burger Menu + Tracking Data + Globe Filters

**Date:** 2026-03-01
**Status:** Approved

---

## Overview

Add a burger menu with a "Tracking Data" toggle (Ongoing / Anticipated) and floating type-filter checkboxes (Conflicts / Natural Disasters) to the CrisisVault globe UI. Default state shows all current conflicts and disasters as impact-scaled bubbles.

---

## Architecture

### Backend

New API route: `GET /api/v1/oracle-events`

- Calls USGS significant earthquakes feed and GDACS RSS directly
- Scores events using TypeScript port of the severity/confidence logic from `ai-service/src/pipeline.py`
- Filters out events already represented by an existing campaign in Supabase
- Returns events from the last 7 days with confidence ≥ 0.40 (below the 0.70 campaign-creation threshold)
- Response shape mirrors `Campaign` type with an added `predicted: true` flag
- Implemented in `apps/api/src/routes/oracleEvents.ts`, registered at prefix `/api/v1`

**Note:** USGS/GDACS calls require outbound HTTPS, which is blocked in the devcontainer sandbox. The route will 500 in dev; graceful empty-state handling on the frontend.

### Frontend

State added to `App.tsx`:
```
trackingMode: 'ongoing' | 'anticipated'   (default: 'ongoing')
showConflicts: boolean                     (default: true)
showNaturalDisasters: boolean              (default: true)
```

Filtered campaigns passed to Globe:
```typescript
const visibleCampaigns = campaigns
  .filter(c => showConflicts        || c.type !== 'conflict')
  .filter(c => showNaturalDisasters || c.type === 'conflict');
```
When `trackingMode === 'anticipated'`, campaigns sourced from `fetchOracleEvents()` instead of `fetchCampaigns()`.

---

## New Components

### `Drawer.tsx`
- Slides in from left edge on burger click, width 260px
- Frosted-glass style matching CampaignPanel (`rgba(10,10,20,0.92)`, `backdropFilter: blur(16px)`)
- Top offset 56px (below TopBar), full height minus StatusStrip
- Click-outside handler closes it
- Contains a single "Tracking Data" section with two radio options

### `TypeFilterOverlay.tsx`
- Fixed position, bottom-left of globe area (`bottom: 40px, left: 16px`)
- Frosted-glass card, always visible (not inside the drawer)
- Two checkboxes: "Conflicts" and "Natural Disasters"
- When both unchecked: globe shows no markers (plain map)

### TopBar changes
- Add `☰` button on left edge, before the logo
- Accepts `onBurgerClick` prop, toggles drawer open/closed

---

## Visual Design

### Bubble markers (Globe)

| Severity | Size | Color — Conflicts | Color — Natural Disasters |
|----------|------|-------------------|--------------------------|
| critical | 28px | `#ff1a1a` | `#ff6600` |
| high     | 20px | `#ff5555` | `#ff9900` |
| medium   | 14px | `#ff8888` | `#ffcc00` |
| low      |  9px | `#ffaaaa` | `#ffee66` |

**Ongoing** (solid fill + semi-transparent glow ring)
**Anticipated** (outline/dashed stroke, no fill — signals "watch list")

---

## Data Flow

```
App.tsx
  trackingMode === 'ongoing'
    → fetchCampaigns({ status: 'active' })  [existing]
  trackingMode === 'anticipated'
    → fetchOracleEvents()                   [new]

  Apply type filters
    → Globe receives visibleCampaigns
    → Globe renders bubble markers
```

---

## Files Changed

| File | Change |
|------|--------|
| `apps/api/src/routes/oracleEvents.ts` | New — live oracle polling route |
| `apps/api/src/index.ts` | Register oracleEvents route |
| `apps/web/src/lib/api.ts` | Add `fetchOracleEvents()` |
| `apps/web/src/App.tsx` | Add state, filtering, wire new components |
| `apps/web/src/components/TopBar.tsx` | Add burger button |
| `apps/web/src/components/Drawer.tsx` | New — slide-out menu |
| `apps/web/src/components/TypeFilterOverlay.tsx` | New — floating checkboxes |
| `apps/web/src/components/Globe.tsx` | Update marker sizes/colors, support `predicted` flag |
