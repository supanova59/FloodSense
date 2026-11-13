# Selected backend integration

The existing Next.js frontend remains the app. `/` is the labelled scenario planner;
`/streets` reads Express/MongoDB, supports accounts, submits observations and gives
administrators a moderation queue.

Browser → same-origin Next.js `/api/street/*` → Express `/api/*` → MongoDB.
The browser holds an HttpOnly, SameSite=Strict session cookie. Next.js forwards its
opaque token; MongoDB stores only its hash. Passwords use salted scrypt. Registration
always creates a resident. There is no default administrator password. Email ownership
verification and password recovery are not implemented yet.

## Local preview without Atlas

Requires Node 24+. In one PowerShell terminal, from the repository root:

```powershell
cd FloodSense-Next/backend-streets
npm ci
npm run preview
```

This starts disposable MongoDB and the backend on port 4003. The MongoDB runtime
downloads if not cached. It never connects to Atlas. Synthetic readings disappear
when stopped. In a second terminal, from the repository root:

```powershell
cd FloodSense-Next/frontend
npm ci
$env:BACKEND_URL = 'http://127.0.0.1:4003'
npm run dev
```

Open `http://localhost:3000/streets`. Select an area, register (12+ character password)
and submit a report. It appears pending in My submissions. The disposable preview
grants no public account administrator access.

## Atlas and moderation

1. Create an Atlas database user with `readWrite` limited to a dedicated database
   such as `floodsense_preview`. Dashboard collaboration is not a database credential.
2. Copy backend `.env.example` to `.env`. Set `MONGO_URI` from Atlas Connect → Drivers,
   including the database name and URL-encoded password. Never commit it.
3. Configure Atlas network access for the backend host. Prefer fixed egress addresses;
   do not silently open every IP. Serverless egress may require a hosting/network decision.
4. Set `DATA_MODE=synthetic` only for an isolated sample database, then `npm run seed`.
   Seeding inserts missing samples and never deletes/overwrites records. Do not put
   fabricated readings into the real dataset database.
5. `npm start` waits for MongoDB and indexes. Use frontend
   `BACKEND_URL=http://127.0.0.1:5000` for this setup.
6. Register the reviewer in the app. In a backend terminal connected to the same
   database, run `npm run admin -- reviewer@example.com`. Then sign in and use the
   moderation queue. Only explicit CLI promotion can make an administrator.

Confirmed reports affect street conditions for 24 hours from submission. Pending or
rejected reports do not. The latest active confirmed reading wins, including lower
readings. Missing/expired observations are UNKNOWN, not CLEAR. Existing databases
with duplicate `(areaSlug, name)` streets must be reviewed before the unique index
can be created; startup fails rather than silently deleting data.

## Netlify: separate frontend and backend projects

Next.js and Express need **two Netlify projects**. The backend entry exports an HTTP
server without listening, awaits MongoDB at startup and disconnects on shutdown.
Netlify Server is Early Access and requires Node 24+, CLI 27.17+ and an eligible
credit-based plan. Confirm team availability before deploying.

Backend settings:

- Base/package: `FloodSense-Next/backend-streets`; use its `netlify.toml`.
- Build: `npm run check`; publish: `public`.
- Functions/runtime variables: `MONGO_URI`, `CLIENT_URL`, `DATA_MODE`,
  `ENABLE_DEMO_SIMULATION=false`, optional `OPENWEATHER_API_KEY`.
- Separate database/credential for preview. Redeploy after environment changes.
- Check `/api/health` returns `{"ready":true}` and `/api/areas` returns data.

Existing frontend settings:

- Keep base `FloodSense-Next/frontend`, build `npm run build`, publish `.next`.
- Set server-side `BACKEND_URL` to the backend HTTPS origin without `/api`.
- Keep `NEXT_PUBLIC_API_BASE_URL` empty for the scenario planner.
- Deploy a PR preview before merging. Never put MongoDB credentials in `NEXT_PUBLIC_*`.
- A backend preview protected by Netlify team SSO cannot be called using the browser's
  SSO cookie through the server proxy. Use an accessible API deployment with application
  authentication; don't disable frontend preview protection as a workaround.

The UI refreshes every 15 seconds while visible. Socket.IO rooms work per instance;
add a shared adapter before depending on cross-instance instant alerts. Database
state and rate limits survive restarts. Authentication limits use Express peer IP,
so requests through a shared frontend proxy share that limit; plan a trusted gateway
strategy before a large public rollout.

## Checks

Backend: `npm run check`, `npm test`. Tests use disposable MongoDB, never Atlas.
Frontend: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

On a hosted preview verify registration, login/logout, area selection, unknown data,
pending submissions, forbidden resident moderation, admin confirmation/rejection,
refreshed street readings, backend-outage errors and mobile layout.

BBMP datasets still require a reviewed import; sample streets are not those datasets.
There is no trained flood/pothole model. The prediction endpoint identifies itself
as an unvalidated heuristic; the UI does not present it as live safety advice.
