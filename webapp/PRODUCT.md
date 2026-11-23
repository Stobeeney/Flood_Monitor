# Manila LRT-2 Flood Monitor — Product Specification

## Purpose
Operational flood monitoring and water-level simulation web dashboard for Metro Manila stations along the **LRT Line 2 corridor** (Recto to Antipolo), pairing spatial flood awareness with raw ultrasonic telemetry (`cm`) and tri-state alert monitoring (**Green / Orange / Red**).

## Target Users
- Municipal / Barangay DRRMO operators and facility engineers monitoring flood-prone corridors in Manila (Recto, Sampaloc, Sta. Mesa / San Juan River, Cubao, Katipunan, Santolan / Marikina River).

## Core User Flows
1. **Authenticated Operator Access:** Operators sign in via Supabase Auth (username or email + password) before accessing dashboard telemetry, threshold controls, or simulation states.
2. **Immediate Hazard Triage (Top KPI Strip):** Operators read raw distance (`cm`), calibrated flood depth (`cm`), and the active **Green (Normal)** / **Orange (Warning)** / **Red (Critical)** state within 2 seconds of landing.
3. **Corridor Spatial Monitoring (Manila LRT-2 Map):** Interactive Leaflet map displaying all 13 LRT-2 stations, live Open-Meteo rainfall/river discharge, and RainViewer precipitation radar. Clicking a station focuses its telemetry and risk profile.
4. **Water Detection Simulation (Right Panel):** Interactive 2D hydrological chamber cross-section showing animated ultrasonic detection pulses and dynamic water rise/recede physics for testing thresholds and reviewing alert behavior.

## Copy & Nomenclature Standards
- All UI labels, statuses, and controls are written in concise English.
- Sensor measurements always specify units (`cm`, `mm`, `m³/s`) with tabular numeric formatting.
- Status labels are strictly consistent across every component: **GREEN (Normal)**, **ORANGE (Warning)**, **RED (Critical)**.
