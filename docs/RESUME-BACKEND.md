# Backend integration checkpoint — 2026-11-13

Resumed at the user's request; BBMP PR #7 integrated into the review branch.

## Saved code

- Branch: `codex/backend-integration`, based on teammate PR #6's
  `origin/feature/mongodb-backend` (da314d7).
- Local backup branch: `codex/backend-integration-work`, commit f8d2edc.
  That backup includes older experiments; the integration branch excludes them.
- Local integration resumed; see GitHub for the latest review PR. No merge to main or cloud backend deployment has been completed.
- Existing production frontend: https://floodsenseweb.netlify.app

Implemented authenticated reporting, MongoDB sessions with password hashing,
administrator moderation, input/area validation, safe socket handlers, insert-only
sample seeding, unknown/expired observation handling, and a Next.js `/streets` UI
using a same-origin HttpOnly-cookie proxy. Added Netlify Server configuration for
a separate backend project, backend CI and integration tests. See
[setup guide](BACKEND-INTEGRATION.md).

## Verification

- Backend syntax and both MongoDB integration tests passed.
- Frontend lint and seven existing tests passed.
- Production build passed on the clean integration branch.
- Standalone typecheck initially encountered stale generated types from the older
  preview branch; the subsequent build regenerated types and passed type validation.
- Local frontend proxy smoke passed: backend data, CSRF rejection, HttpOnly session,
  pending reports, role guard and logout.
- Production backend dependency audit reported zero vulnerabilities.
- Browser visual testing and hosted end-to-end testing remain outstanding.

## Local preview at pause

Backend preview was started on port 4003 (tool session 34250); frontend production
preview on port 3004 (session 31943). They may still be running, but do not assume
they survive restarting Codex. The frontend build was regenerated after starting
the preview, so restart the frontend before further browser testing.
Preview MongoDB is disposable; test accounts/data are not persistent Atlas data.

## Cloud state and remaining work

- Atlas Project 0: 6ac8668d5d393c1c4e5c1afe; Cluster0, free GCP ASIA_SOUTH_1.
- Atlas inspection only: four individual IP allowlist entries and two existing
  broad admin database users. No credentials, data, users or network rules changed.
- Netlify frontend project: 3fd795d2-f6b9-4096-9192-d0ad8f5c85a4.
- No backend Netlify project has been provisioned. Frontend needs server-side
  BACKEND_URL; backend needs a restricted database credential and approved network
  access. Avoid broadening Atlas access or using existing admin accounts silently.
- Netlify Server requires an eligible plan, Node 24+ and CLI 27.17+; backend must
  be a separate project from Next.js. SSO-protected backend previews need an explicit
  server-to-server access approach.
- UI uses 15-second polling. Socket rooms are instance-local; do not claim global
  instantaneous notifications. BBMP reference layers from PR #7 are now served as static GeoJSON; no MongoDB dataset import was performed.

When resumed: inspect Git status, confirm clean branch contents, restart/recheck
the preview, finish hosted configuration safely, push a review branch and open a
PR referencing #1/#6. Do not mark deployment complete or merge before verification.
