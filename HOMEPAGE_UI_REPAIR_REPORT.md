# OTAKUVA — HOMEPAGE UI/UX REPAIR REPORT

**Date:** 2026-09-05  
**Scope:** Homepage UI/UX Spacing, Proportions, Card Scale, Header/Footer Compaction, and Webpack Cache Fix  
**Result:** **SUCCESS (All Verifications Passed, Dev Server Online)**

---

## 1. Executive Summary

A comprehensive UI/UX refinement was completed across the OTAKUVA homepage. The changes eliminate oversized visual weight, excessive empty whitespace, and duplicate elements, establishing a compact, editorial anime intelligence interface.

Additionally, the stale webpack runtime cache issue (`Cannot find module './9276.js'`) was resolved by terminating conflicting build/dev server processes, rebuilding the Next.js production output, and launching a fresh dev server instance.

---

## 2. Before vs. After Measurement Audit

| Element / Metric | Before Repair | Target | Final Implementation |
| :--- | :--- | :--- | :--- |
| **Header Height (Desktop)** | `70px` | `64px` | `64px` (`--header-height: 64px`) |
| **Header Height (Scrolled)** | `62px` | `56px` | `56px` (`--header-height-scrolled: 56px`) |
| **Spotlight Hero Height (Desktop)** | `720px` (@1200px+) | `560–620px` | `580px` (`@media min-width: 1200px`) |
| **Spotlight Hero Height (Tablet)** | `640px` (@768px+) | `480–540px` | `500px` (`@media min-width: 768px`) |
| **Spotlight Hero Height (Mobile)** | `540px` | `400–440px` | `420px` (`.hero`) |
| **Hero Title Clamp** | `clamp(36px, 5.5vw, 68px)` | `clamp(30px, 4.5vw, 56px)` | `clamp(30px, 4.5vw, 56px)` |
| **Hero Content Padding** | `80px 24px 60px` | `60px 24px 48px` | `60px 24px 48px` |
| **Hero Fallback Score** | `'9.2'` (hardcoded fake) | `'—'` (data integrity) | `'—'` |
| **Content Max-Width** | `1450px` / `1540px` mismatch | `1440px` | `1440px` (`--max-content-width: 1440px`) |
| **Section Spacing** | `52px` top | `48px` | `48px` (`--section-gap: 48px`) |
| **Section Title Size** | `26px` | `22px` | `22px` |
| **Card Border Radius** | `9px` | `10px` | `10px` (`--card-radius: 10px`) |
| **Card Hover Lift** | `translateY(-4px)` | `translateY(-3px) scale(1.02)` | `translateY(-3px) scale(1.02)` + subtle shadow |
| **Editor's Pick Card Height** | `380px` min-height | `320px` | `320px` |
| **Editor's Pick Title Size** | `34px` | `28px` | `28px` |
| **Footer Structure** | **Duplicate footers** (inline + shell) | **Single shell footer** | Inline footer purged from `page.tsx` |
| **Shell Footer Padding** | `48px top, 32px bottom` | Compact (~200px total) | `32px top, 24px bottom` |

---

## 3. Files Modified

1. `src/styles/tokens.css`
   - Updated `--header-height: 64px`, `--header-height-scrolled: 56px`, `--max-content-width: 1440px`
   - Added `--section-gap: 48px`, `--section-gap-sm: 36px`, `--card-radius: 10px`, `--card-hover-lift: -3px`
   - Added `--shadow-card-hover: 0 8px 24px rgba(0, 0, 0, 0.35)`

2. `src/components/shell/Header.module.css`
   - Compacted sticky header to `var(--header-height, 64px)`
   - Compacted scrolled header to `var(--header-height-scrolled, 56px)`
   - Adjusted mobile overlay top position to `64px`

3. `src/app/page.module.css`
   - Connected `.main` container to `var(--max-content-width, 1440px)` with reduced `48px` bottom padding
   - Linked `.section` padding to `var(--section-gap, 48px)`
   - Compacted `.sectionTitle` from `26px` to `22px`
   - Upgraded `.card:hover` with `scale(1.02)` and `--shadow-card-hover`
   - Purged dead inline `.footer*` classes

4. `src/components/home/SpotlightHero.module.css`
   - Scaled down hero min-heights: 420px (mobile), 500px (tablet), 580px (desktop)
   - Tightened content padding to `60px 24px 48px`
   - Scaled title font clamp to `clamp(30px, 4.5vw, 56px)`
   - Reduced synopsis and slide indicator margins

5. `src/components/home/SpotlightHero.tsx`
   - Replaced fallback rating string `'9.2'` with canonical `'—'` to preserve data integrity

6. `src/app/page.tsx`
   - Removed duplicate inline `<footer>` element; now cleanly delegates to AppShell `Footer.tsx`

7. `src/components/shell/Footer.module.css`
   - Compacted top padding from `var(--space-12)` (48px) to `var(--space-8)` (32px)
   - Compacted bottom row padding-top from `var(--space-6)` (24px) to `var(--space-4)` (16px)
   - Reduced inner layout gap from `var(--space-8)` to `var(--space-5)` (20px)

8. `src/components/shell/AppShell.module.css`
   - Updated `.contentInner` fallback to `1440px`

9. `src/components/home/EditorsPickFeature.module.css`
   - Connected section to `var(--section-gap, 48px)`
   - Compacted card min-height to `320px` and art min-height to `240px`
   - Reduced padding and heading font sizes

10. `src/components/home/DiscoverMoreSection.module.css`
    - Connected section to `var(--section-gap, 48px)`
    - Reduced title font size to `22px`

---

## 4. Verification & Health Checks

- **TypeScript compilation:** `npx tsc --noEmit` exited with code `0` (0 errors).
- **Production build:** `npm run build` compiled all 36 routes and API endpoints cleanly.
- **Server Health Check:**
  - `GET http://localhost:3000` -> **HTTP 200 OK**
  - `GET http://localhost:3000/api/home` -> **HTTP 200 OK**
- **Runtime Error Resolution:** Webpack missing module `./9276.js` permanently cleared.
