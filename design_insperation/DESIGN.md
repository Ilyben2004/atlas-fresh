---
name: Atlas Fresh
colors:
  surface: '#fbffa9'
  surface-dim: '#dbe172'
  surface-bright: '#fbffa9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5fb88'
  surface-container: '#eff583'
  surface-container-high: '#e9ef7e'
  surface-container-highest: '#e4e979'
  on-surface: '#1b1d00'
  on-surface-variant: '#454837'
  inverse-surface: '#303300'
  inverse-on-surface: '#f2f886'
  outline: '#767965'
  outline-variant: '#c6c8b2'
  surface-tint: '#546500'
  primary: '#546500'
  on-primary: '#ffffff'
  primary-container: '#8fa723'
  on-primary-container: '#2e3900'
  inverse-primary: '#b8d24c'
  secondary: '#586421'
  on-secondary: '#ffffff'
  secondary-container: '#dbea98'
  on-secondary-container: '#5e6a27'
  tertiary: '#9b4500'
  on-tertiary: '#ffffff'
  tertiary-container: '#ee7f38'
  on-tertiary-container: '#5a2500'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d4ee65'
  primary-fixed-dim: '#b8d24c'
  on-primary-fixed: '#181e00'
  on-primary-fixed-variant: '#3f4c00'
  secondary-fixed: '#dbea98'
  secondary-fixed-dim: '#bfce7f'
  on-secondary-fixed: '#181e00'
  on-secondary-fixed-variant: '#404c0a'
  tertiary-fixed: '#ffdbca'
  tertiary-fixed-dim: '#ffb68e'
  on-tertiary-fixed: '#331200'
  on-tertiary-fixed-variant: '#763300'
  background: '#fbffa9'
  on-background: '#1b1d00'
  surface-variant: '#e4e979'
typography:
  display-lg:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.04em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '500'
    lineHeight: 12px
    letterSpacing: 0.06em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-tablet: 1.25rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-tablet: 1.5rem
  margin-desktop: 2.5rem
  space-2xs: 0.125rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system delivers an operational, high-efficiency interface for modern agricultural logistics, cold-chain monitoring, and bulk commodity freight. Inspired by the crisp vitality of Granny Smith apples, the aesthetic pairs agricultural utility with institutional-grade enterprise precision.

The visual direction rejects generic enterprise blue in favor of a crisp, agrarian-technical palette: pure whites, paper-matte pale lemon washes, vibrant orchard greens, and deep vegetal olives. The tone is utilitarian, exact, and hyper-legible under demanding field and terminal conditions.

The overall style combines **Minimalism** with **Low-contrast Outlines** and subtle tonal tiling. Surfaces avoid artificial heavy drop shadows, relying instead on 1px crisp architectural borders, surgical spacing rhythm, and clear typographic hierarchy to structure dense logistical telemetry, weighbridge receipts, and fleet manifests.

## Colors

The palette establishes strict contrast thresholds to maintain high legibility in field tablet environments and ambient depot lighting:

- **Canvas & Surface Base:** Pure Canvas (`#FFFFFF`) serves as the base for high-density data grids and forms. Secondary Background (`#FAFBF4`) provides the foundational canvas layer across dashboards, sidebars, and inactive panels.
- **Brand Primary Accent (`#8FA723` / `#9AAE37`):** Represents vitality, verified status, active states, and primary action affordances. Used on primary buttons, active route paths, and confirmed metrics.
- **Primary Text & Headings (`#3D4806`):** A dense, bio-pigmented Dark Olive that replaces harsh carbon black, offering optimal contrast against `#FFFFFF` and `#FAFBF4` while preserving the horticultural theme.
- **Secondary Neutral Text (`#6D7208`):** Muted Olive-Earth dedicated to metadata labels, tabular column captions, transit timestamps, and non-active icons.
- **Structural Outlines & Tints (`#EAF1AC` / `#E3E566`):** Light Lemon-Green borders and subtle fills. Used for table header bands, structural dividers, KPI card strokes, and subtle selected-state tints.
- **Warning & Compliance Tertiary (`#B45309` / Deep Amber `#654A09`):** Reserved for temperature excursions, demurrage warnings, customs delays, and load-variance alerts.

## Typography

The type system blends industrial precision with technical speed:

- **Headings (`Space Grotesk`):** Technical, geometric, and clear. Gives freight bill summaries, tonnage headers, and facility titles a modern logistical character.
- **Body (`Hanken Grotesk`):** Balanced, highly legible neutral grotesque engineered for rapid scanning of long manifest entries, load conditions, and address blocks.
- **Metadata & Data Labels (`JetBrains Mono`):** Dedicated to cold-chain temperature readings (`+3.4°C`), ISO container IDs (`MSKU-902144-8`), SKU weights, timestamps, and currency valuations. Always rendered in tabular-lining numbers for precise vertical alignment in multi-row grids.

## Layout & Spacing

The layout is built upon an uncompromising 8pt enterprise grid with a 4pt sub-grid for dense operational tables and toolbars:

- **Desktop Layout (≥1280px):** 12-column fluid grid with `gutter-desktop` (1.5rem / 24px) and `margin-desktop` (2.5rem / 40px). Max content container constraints can extend to 1600px for panoramic dispatch views.
- **Tablet & Toughbook Layout (768px - 1279px):** 8-column layout with 20px gutters and 24px outer margins, allowing split-pane side sheets for yard check-ins.
- **Mobile Handheld (<768px):** 4-column layout with 16px gutters and 16px margins, stacking telemetry metrics vertically.
- **Rhythm & Padding:** Dense data modules use `space-xs` (4px) and `space-sm` (8px) for inline cell packaging, while primary structural sections rely on `space-lg` (24px) and `space-xl` (40px) to prevent cognitive overload in complex fleet dashboards.

## Elevation & Depth

This design system rejects heavy, soft-blurred drop shadows, which cause visual mud and render unpredictably on outdoor or low-contrast display hardware. Instead, depth is achieved through **structural outlines and disciplined surface layering**:

- **Layer 0 (Canvas):** Base level filled with `#FAFBF4`. Houses layout gutters, page navigation backdrops, and overall framing.
- **Layer 1 (Card & Module Surfaces):** Solid `#FFFFFF` surfaces defined by a crisp `1px solid #EAF1AC` border. This separation delivers a pristine, daylight-readable card perimeter.
- **Layer 2 (Floating Modals & Flyouts):** Used for dispatch dispatchers, filters, and consignment drawers. Solid `#FFFFFF` framed with `1px solid #D5E08B`, supported exclusively by a micro edge-occlusion shadow: `0 4px 16px -2px rgba(61, 72, 6, 0.08)`.
- **Active & Highlight Tiers:** Selected table rows and focused cards apply an inner wash of `#FAFBF4` paired with an active boundary stroke in `#8FA723`.

## Shapes

The interface embraces a functional, architectural geometry. A minimal radius of `0.25rem` (4px) is standard across inputs, operational cards, data cells, and metric counters, shifting to `0.5rem` (8px) for larger dialog viewports and modal panels. 

This restrained curvature preserves screen real-estate for tabular density, aligns with strict grid boundaries, and prevents the casual, consumer-app appearance that undermines mission-critical tools.

## Components

### Buttons
- **Primary Action:** Solid Apple Green (`#8FA723` or `#9AAE37`), text in `#FFFFFF`, font weight 600, border radius `0.25rem`, with a 1px border matching `#7D931D`. Hover shifts to `#7E941E`. Focus ring uses a 2px offset border in `#3D4806`.
- **Secondary Action:** Surface `#FFFFFF`, 1px border in `#EAF1AC`, text in `#3D4806`. Hover applies background `#FAFBF4` and border `#9AAE37`.
- **Destructive/Alert:** Surface `#FAFBF4`, 1px border in `#B45309`, text in `#B45309`.

### Chips & Telemetry Badges
- Constructed with a height of 22px, `rounded-sm` (2px radius), and padding `2px 8px`. Uses `label-md` (`JetBrains Mono`).
- **Cold-Chain Optimal:** Background `#F2F7D2`, border `1px solid #9AAE37`, text `#3D4806`.
- **Warning / Demurrage:** Background `#FEF3C7`, border `1px solid #F59E0B`, text `#654A09`.
- **Inactive / Route Queued:** Background `#FAFBF4`, border `1px solid #EAF1AC`, text `#6D7208`.

### Data Tables & Manifests
- **Header Band:** Surface `#F4F8D8`, border-bottom `1px solid #E3E566`. Text styled in `label-sm` (`JetBrains Mono`), uppercase, color `#3D4806`.
- **Rows:** Background alternating between `#FFFFFF` and `#FCFDF9`. Border-bottom `1px solid #F0F4CE`.
- **Row Hover & Selection:** Hover applies `#FAFBF4`; active selection applies `#F6F9DF` with a leading 3px accent bar in `#8FA723`.

### Input Fields & Selectors
- Background `#FFFFFF`, 1px border in `#EAF1AC`, text in `#3D4806`.
- Placeholder text in `#6D7208` at 60% opacity.
- Focus state switches border to `1.5px solid #8FA723` with no outer glow.
- Monospace values (`JetBrains Mono`) for weight entries, seal numbers, and barcode fields.

### Checkboxes & Radios
- Square with 2px radius for checkboxes; circular for radios.
- Unchecked: `#FFFFFF` background with `1.5px solid #6D7208`.
- Checked: `#8FA723` background with pure `#FFFFFF` check/dot indicator.

### Operational KPI Cards
- Base surface in `#FFFFFF`, framed with `1px solid #EAF1AC`.
- Header metadata in `label-md` (`#6D7208`), primary KPI in `Space Grotesk` (`#3D4806`), and unit descriptors in `JetBrains Mono`.