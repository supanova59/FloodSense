# Combined frontend preview

The single Next.js dashboard now opens on **My neighbourhood**. The original
Overview, Risk explorer, Route intelligence, Community reports and City operations
components remain in its navigation, including the BBMP map layers.

The finalized street experience is incorporated into that same shell: study area,
summary cards, rainfall, street depth/status, drainage scores, expandable pothole
details, formula ETA, refresh, cloudburst control, area alert stream, community feed,
report submission, sign-in, personal submissions and reviewer moderation.

The server returns data; users interact only with the frontend. `/streets` is an
alias of the same dashboard, no longer a separate app. Original scenario components
remain explicitly simulated rather than pretending their scores are backend data.

## Working local preview

Backend terminal in `FloodSense-Next/backend-streets`:

```powershell
$env:PREVIEW_PORT='4004'
npm run preview
```

The loopback-only backend uses disposable MongoDB, synthetic samples, and creates
a reviewer with a random password printed in that terminal. It enables simulation
only in this disposable environment. No Atlas data or production privileges change.

Frontend terminal in `FloodSense-Next/frontend`:

```powershell
$env:BACKEND_URL='http://127.0.0.1:4004'
$env:NEXT_PUBLIC_STREET_SOCKET_URL='http://127.0.0.1:4004'
npm run dev -- --port 3005
```

Open http://localhost:3005. Sign in with the printed local reviewer account to test
cloudburst events and moderation. Regular registered accounts can submit reports.
Changing areas leaves the previous socket room; reconnects resubscribe. A 15-second
refresh remains available when sockets are disconnected. Alerts are session-only.

Drainage/pothole/ETA cards retain their components but display unavailable/unsurveyed
in observation mode until a real source exists. Seeded values are explicitly synthetic.

For hosting, configure BACKEND_URL and NEXT_PUBLIC_STREET_SOCKET_URL to the hosted
API origin and set CLIENT_URL to the exact frontend origin. Rebuild after changing
the public socket URL. Do not use localhost URLs on Netlify. Hosted Atlas integration
is still outstanding; a successful frontend deploy alone does not establish it.

## Validation note
Frontend lint/typecheck, 11 tests and production build passed. Browser testing verified reviewer login, cloudburst/socket delivery, submission, moderation, and retention of Overview. The proxy smoke checks hostile-origin rejection and session handling.

Dependency audit still flags the existing Next.js transitive PostCSS dependency (one high and one moderate production finding). Plan a tested dependency remediation before production acceptance; this UI preview does not claim production readiness.
