# BBMP reference-layer review

Integrated teammate commit `691840c` from `feature/bbmp-flood-layers` into the
backend integration branch, preserving authorship. This change serves reference
GeoJSON from Netlify; it does not import these records into MongoDB.

The source files contain 399 records: 70 flood-prone, 200 flood-vulnerable and 129
low-lying. The converter omits one low-lying record with invalid coordinates, so
398 points are displayed. Coordinates use GeoJSON longitude/latitude ordering.
Source records with coincident coordinates are retained, not silently deduplicated:
they may describe different locations. Do not add overlapping layers together as
a count of unique hazards.

The supplied exports are labelled BBMP. Their original publication URL, release
date and licence have not been established; the UI states this limitation. These
are historical/reference locations, not live flood readings, trained-model output
or verification of any community report. They do not change route/risk scores.

Review fixes: render tooltip names as text rather than HTML, reject malformed
GeoJSON collections/features, enforce finite IDs and Bengaluru coordinate bounds,
use a hydration-consistent layer-panel state, and document provenance uncertainty.

Run `npm run data:build` in the frontend after source changes. Then run frontend
tests and inspect the generated diff. Backend community observations remain in
their separate MongoDB models and moderation flow.
