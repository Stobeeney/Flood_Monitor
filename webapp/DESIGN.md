# Manila LRT-2 Flood Monitor — Design System (`impeccable` Spec)

## Visual Direction
High-legibility **Operational Hydro-Telemetry Command Center** modeled on crisp light-surface dispatch dashboards and themed in **Manila LRT Line 2 Purple**: a deep LRT-2 Purple left navigation rail & utility header (`#6B21A8`) paired with a calm cool-neutral workspace (`#F4F6F8`) and `1px`-bordered white telemetry cards (`#FFFFFF`).

## Typography
- **Headings:** `Space Grotesk`, sans-serif (weights 600–700, tight tracking `-0.02em`)
- **UI Body & Labels:** `Plus Jakarta Sans`, sans-serif (weights 400–600)
- **Telemetry & Coordinates:** `JetBrains Mono`, monospace (`font-variant-numeric: tabular-nums`)

## Color Tokens
- **LRT-2 Brand Navigation Rail:** `#6B21A8` surface (`#581C87` border), `#FFFFFF` active pill with `#4C1D95` ink, `#F5F3FF` secondary labels, `#2E1065` high-contrast action controls
- **Workspace Canvas:** `#F4F6F8` background, `#FFFFFF` card surface, `#E2E8F0` hairline border (`1px`)
- **Primary Ink:** `#0F172A` headings/values, `#475569` secondary, `#64748B` muted captions
- **Semantic Alert Levels (Green / Orange / Red):**
  - `GREEN` (Normal, `raw > warningCm`): `#16A34A` primary, `#DCFCE7` soft fill, `#86EFAC` border
  - `ORANGE` (Warning, `alertCm < raw <= warningCm`): `#EA580C` primary, `#FFEDD5` soft fill, `#FDBA74` border
  - `RED` (Critical Flood, `raw <= alertCm`): `#DC2626` primary, `#FEE2E2` soft fill, `#FCA5A5` border
- **Hydro Simulation Accent:** `#0284C7` (sensor beam), dynamic surface tint matching active alert level.

## Anti-Pattern Guardrails
- Zero emoji icons anywhere in UI; use `lucide-react` strokes (`1.75px`).
- Zero purple-to-blue gradients or glassmorphism backdrop blurs on data cards.
- Consistent `10px` card border-radius (`6px` for badges/inputs) — no nested card-inside-card bloat.
- All interactive controls maintain visible keyboard focus rings (`2px solid #0F172A`) and WCAG AA contrast.
