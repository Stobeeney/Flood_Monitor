# Manila LRT-2 Flood Monitor Webapp

Operational flood-monitoring dashboard themed in **Manila LRT Line 2 Purple** (`#6B21A8`), featuring Supabase authentication, an interactive Manila LRT-2 map, raw ultrasonic telemetry (`cm`), **Green / Orange / Red** warning indicators, and a live 2D water-level detection simulator.

## Running Locally

```bash
cd webapp
npm install
npm run dev
```

Then open `http://localhost:5173`.

## Connecting Supabase Auth

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from your Supabase Project Settings → API.
3. Run `supabase/schema.sql` in the Supabase SQL Editor to enable username-based operator login (`profiles`) and optional `flood_readings` persistence.

> While `.env` is unconfigured, **Preview Auth** lets you sign in immediately using demo operator credentials (`operator.manila` / `manila-lrt2`) to inspect the UI/UX and simulator.

## Map & Weather APIs

- **OpenStreetMap + Leaflet**: Manila LRT Line 2 corridor (Recto to Antipolo, 13 stations) and flood hotspot zones.
- **Open-Meteo Weather & Flood API**: Live rainfall (`mm`), temperature (`°C`), and river discharge (`m³/s`) for Manila coordinates.
- **RainViewer Weather Radar API**: Live precipitation radar tile overlay.
