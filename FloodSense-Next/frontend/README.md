# FloodSense — Next.js Frontend

A professional **frontend-only** prototype built with Next.js (App Router), React, Tailwind CSS, TypeScript, and Leaflet / OpenStreetMap tiles.

## Get started

Prerequisites: Node.js 20.9+ and an internet connection for installing dependencies and map tiles.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## What works

- Responsive app shell and five views: Overview, Risk explorer, Route intelligence, Community reports, City operations.
- Real Leaflet map with OpenStreetMap-derived CARTO tiles, clickable markers and map interactions.
- Rainfall scenario selector and 0–60 min forecast slider updating location risk scores.
- Six illustrative Bengaluru locations, demo risk score breakdowns, locally generated risk rankings.
- Two illustrative network paths with simulated estimates (NOT real map-based routing).
- Community reports form and filters; new reports persist within this browser tab/session via sessionStorage.
- Operations action simulation; nothing is dispatched.
- Export a CSV of the current modeled risk scores.
- Proposed API contract JSON preview for future backend work.

## Important

All water-level, flood-risk, rainfall, route and report data are **simulated**. No physical sensors, backend, database, external weather API, realtime service, AI analysis, or notification infrastructure is used. Do not use results for safety decisions. Photo selection displays the filename only — images aren't uploaded or AI-processed.

## Where to plug in a backend later

- `lib/demo.ts`: domain types (`Zone`, `Report`, `Scenario`), sample datasets, simulation/risk functions, and graph pathfinding.
- `components/Dashboard.tsx`: application state and handlers. Replace its local sample state with API-fetching hooks once endpoints are available.
- `components/RiskMap.tsx`: Leaflet presentation component; accepts typed zones, risks, selection and route props.

Possible future endpoints (not implemented):

```
GET    /api/v1/zones
GET    /api/v1/forecast?minutes=30
GET    /api/v1/reports
POST   /api/v1/reports
POST   /api/v1/routes/assess
GET    /api/v1/operations
WS     /ws/v1/telemetry
```

To connect live data, replace the deterministic `score()` outputs and sample reports with validated, timestamped backend data. Keep demo/live labeling distinct and add proper authentication/authorization for operations before real use.

## Project structure

```
app/
  layout.tsx           # App metadata and global styles
  page.tsx             # Main entry
  globals.css          # Tailwind and shared component utilities
components/
  Dashboard.tsx        # Five views and demo interactions
  RiskMap.tsx          # Client-only Leaflet map
lib/
  demo.ts              # Typed sample data, risks, paths
```
