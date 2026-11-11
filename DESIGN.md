---
name: MoneyMate
theme: light
palette:
  background: "#EEF6FF"
  surface: "#FFFFFF"
  text: "#0F2942"
  text-muted: "#475569"
  accent: "#0284C7"
  border: "#93C5FD"
  semantic:
    success: "#0284C7"
    warning: "#1E3A8A"
    error: "#DC2626"
    info: "#0284C7"
fonts:
  display: "Mitr"
  body: "Anuphan"
  mono: "JetBrains Mono"
radii:
  sm: "6px"
  md: "12px"
  lg: "20px"
  full: "9999px"
---

# MoneyMate — Design System

## Overview

MoneyMate (**เพื่อนช่วยจัดการเงิน**) adopts a **Cute Kakeibo Stationery Ledger & Stamp-Verified Slip Desk** aesthetic. Inspired by Japanese Kakeibo household accounting notebooks and crisp blue-grid stationery pads, the interface balances warm, rounded Thai typography (`Mitr` & `Mali`) with disciplined financial ledger structure (`Anuphan` + `JetBrains Mono` with `tabular-nums`).

Every surface feels like a physical sheet of pure white paper (`#FFFFFF`) resting on a soft sky-blue desk mat (`#EEF6FF`), framed by clean sky-blue borders (`#93C5FD`) and deep royal navy structural ink (`#1E3A8A`), with vibrant crimson red (`#DC2626`) reserved strictly for outflows, VAT/tax stamps, duplicate-slip alerts, and traditional accounting double-underline summary rules.

## Colors

| Role | Token | Hex | Usage |
| :--- | :--- | :--- | :--- |
| **Desk Mat (Canvas)** | `--color-bg-page` | `#EEF6FF` | Main page background and subtle 24px ledger grid surface |
| **Paper Sheet (Surface)** | `--color-surface` | `#FFFFFF` | Primary ledger sheets, tables, forms, and interactive trays |
| **Sky Tint (Subtle Fill)** | `--color-surface-elevated` | `#F4F9FF` | Hover states, table headers, and active navigation fills |
| **Deep Navy Ink (Text)** | `--color-text-primary` | `#0F2942` | Primary headings, body copy, and transaction descriptions |
| **Royal Navy (Brand Anchor)** | `--color-navy-primary` | `#1E3A8A` | Primary CTA buttons, top bar anchors, and net-balance figures |
| **Sky Blue (Inflow & Active)** | `--color-sky-primary` | `#0284C7` | Income (`+฿`), interactive sliders, focus rings, and links |
| **Crimson Red (Outflow & Stamp)** | `--color-crimson-primary` | `#DC2626` | Expenses (`-฿`), duplicate-slip alerts, red double accounting rules |
| **Crimson Tint (Alert Badge)** | `--color-crimson-soft` | `#FFE4E6` | Soft background tint for outflow and alert badges |
| **Rule Line (Border)** | `--color-border-subtle` | `#BFDBFE` | Standard 1px horizontal/vertical ledger rules |
| **Frame Border (Strong)** | `--color-border-strong` | `#93C5FD` | 2px outer stationery sheet border |

### Browser Surface Tokens
- **`::selection`**: Background `#0284C7` (Sky Blue), text `#FFFFFF` (Pure White)
- **`caret-color`**: `#DC2626` (Crimson Red pen nib)
- **`scrollbar-color`**: `#93C5FD #EEF6FF` (Sky Blue thumb on Sky Mat track)

## Typography

| Role | Font Family | Weights | Tracking / Leading | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Display & Headings** | `Mitr` | `500`, `600` | `-0.015em` / `1.22` | Page titles, section headers, and friendly conversational prompts |
| **Cute Pill Badges** | `Mali` | `600`, `700` | `0em` / `1.3` | Handwritten-style stationery stickers, category tags, and stamp labels |
| **Body & Ledger Rows** | `Anuphan` | `400`, `500`, `600`, `700` | `0em` / `1.6` | All UI controls, form labels, and multi-column ledger tables |
| **Financial Figures & IDs** | `JetBrains Mono` | `500`, `600`, `700` | `0em` / `1.4` (`tabular-nums`) | Currency amounts (`฿`), VAT 7%, slip Reference IDs, and timestamps |

## Layout

- **Grid & Container**: Max width `1280px` (`max-w-7xl`) with `16px` mobile / `32px` desktop horizontal padding.
- **Spacing Scale**: Base `4px` unit (`4, 8, 12, 16, 24, 32, 48, 64px`). Spacing between distinct stationery sheets is at least `2×` the internal group spacing (`gap_between >= 2 * gap_inside`).
- **Ledger Composition**: Prefer unified horizontal ledger strips (`divide-x` / `divide-y` with `1px solid #BFDBFE`) over scattered cards.
- **Responsive Stress**: All interactive controls remain unclipped and operable at `320px` viewport width and `200%` browser zoom.

## Elevation & Depth

- **Stationery Offset Shadow**: Instead of blurry glassmorphism or heavy dark drop shadows, sheets use a crisp offset stationery shadow: `0 6px 0 0 #CFE4FF` (`--shadow-card`).
- **Borders First**: Structural hierarchy is communicated via `2px solid #93C5FD` outer frames and `1px solid #BFDBFE` inner rules.

## Shapes

- **Concentric Radii**:
  - Outer stationery sheet (`--radius-outer`): `20px` (`1.25rem`) with `8px` (`0.5rem`) padding around inner wells.
  - Inner control / cell (`--radius-inner`): `12px` (`0.75rem`), satisfying `outer_radius = inner_radius + padding` (`20px = 12px + 8px`).
  - Stickers & pill tags: `9999px` (`rounded-full`).
- **Signature Accounting Rule (`.mm-double-rule-red`)**: `border-bottom: 4px double #DC2626` under net balance totals and section summaries.

## Components

- **Interactive Slip Tray**: Full-bleed unified workspace on `/` where visitors switch between 5 real Thai slips, toggle PDPA privacy masking, and inspect live VAT 7% + duplicate reference detection without nested cards.
- **Unified Summary Ledger Strip**: 4-column horizontal accounting strip on `/app/dashboard` (`รายรับรวม`, `รายจ่ายรวม`, `ยอดคงเหลือสุทธิ`, `เอกสารรอตรวจสอบ`) separated by `1px` sky-blue vertical rules instead of 4 separate SaaS metric cards.
- **Crimson Stamp Pill (`.mm-stamp-red`)**: `1.5px solid #DC2626` pill with `#FFE4E6` background, `#B91C1C` text, and subtle `-1.5deg` stamp tilt for verified tax/alert tags.

## Do's and Don'ts

### Do
- Use strictly the 4-color system: **ฟ้า (`#0284C7` / `#EEF6FF`), น้ำเงิน (`#1E3A8A` / `#0F2942`), ขาว (`#FFFFFF`), แดง (`#DC2626` / `#FFE4E6`)**.
- Apply `font-mono tabular-nums` to every currency figure (`฿`), percentage, and slip Reference ID.
- Name every transitioned CSS property explicitly (`transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease, transform 150ms ease`) and respect `prefers-reduced-motion: reduce`.

### Don't
- Never place uppercase/small-caps eyebrow kickers directly above headings (`<p class="text-xs uppercase">...</p><h2>...</h2>`). Let the `Mitr` heading open its section directly.
- Never wrap a single word inside a heading in a `<span class="text-...">` color highlight.
- Never use `3px`–`4px` colored left border stripes on cards or alerts; use top header strips or crimson stamp pills instead.
- Never use emoji characters (`✨`, `🚀`, `🔒`) as UI icons or bullet markers; use crisp `lucide-react` SVG icons.
- Never join metadata with middle-dot strings (`A · B · C`); use structured flex rows with pill badges or vertical rules.
