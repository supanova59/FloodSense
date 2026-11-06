# FloodSense — Next.js Frontend

A **frontend-only** prototype built with Next.js (App Router), React, Tailwind CSS, TypeScript, and Leaflet / OpenStreetMap tiles.

Live production: https://floodsenseweb.netlify.app (reflects merged `main`; frontend improvements on a PR appear only after merge or in its preview).

See [the engineering and review guide](../../docs/FRONTEND-REVIEW.md) for architecture, proposed database relationships, API contract, rubric evidence, limitations and a demo/QA script.

## Get started

Prerequisites: Node.js 20.9+ and an internet connection for installing dependencies and map tiles.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

Checks: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. GitHub Actions runs these on pull requests. Node 22 LTS is used by CI.

## What works

- Responsive app shell and five views: Overview, Risk explorer, Route intelligence, Community reports, City operations.
- Real Leaflet map with OpenStreetMap standard tiles, clickable markers and map interactions.
- Rainfall scenario selector and 0–60 min forecast slider updating location risk scores.
- Expandable risk contribution breakdown from the exact scoring function, severity thresholds, and explanatory route comparison.
- Six illustrative Bengaluru locations, demo risk score breakdowns, locally generated risk rankings.
- Two illustrative network paths with simulated estimates (NOT real map-based routing).
- Community reports form and filters; new reports persist within this browser tab/session via sessionStorage.
- Native keyboard-accessible report dialog, timestamps, sample/community labels, validated local photo preview, explicit storage errors, refresh and confirmed reset.
- Keyboard location controls, map failure feedback/retry, and reduced-motion-aware feedback animations.
- Operations action simulation; nothing is dispatched.
- Export a CSV of the current modeled risk scores.
- Proposed API contract JSON preview for future backend work.

## Important

Water-level samples, flood-risk, rainfall and route estimates are **simulated**. Community observations are unverified. No physical sensors, backend, database, external weather API, realtime service, AI analysis, or notification infrastructure is included. Do not use results for safety decisions. Images are previewed locally only — they are not uploaded, persisted, or AI-processed. Assigning a demonstration team changes response status only; it does not reduce environmental risk.

## Where to plug in a backend later

- `lib/demo.ts`: domain types (`Zone`, `Report`, `Scenario`), sample datasets, simulation/risk functions, and graph pathfinding.
- `lib/reports.ts`: typed report repository, validated session storage, and an optional HTTP adapter. Leave `NEXT_PUBLIC_API_BASE_URL` unset for demo mode; set it to the agreed API prefix to opt into HTTP mode, then rebuild. No server is included and no privileged credential belongs in this public variable.
- `components/Dashboard.tsx`: application state and handlers, with loading/error/retry feedback. It calls the repository instead of accessing storage directly.
- `components/ReportDialog.tsx`: report form, validation, native modal focus handling, local image preview and async submission.
- `components/RiskMap.tsx`: Leaflet presentation component; accepts typed zones, risks, selection and route props.

The implemented HTTP adapter contract (server not implemented):

```
GET  {NEXT_PUBLIC_API_BASE_URL}/reports -> Report[]
POST {NEXT_PUBLIC_API_BASE_URL}/reports -> saved Report
```

Payloads, timestamp units, credential/CORS expectations and proposed schema are specified in the engineering guide. Requests never silently fall back to session storage after service failure. Future expansion may add:

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
