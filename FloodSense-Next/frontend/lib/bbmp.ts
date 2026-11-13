// Supplied BBMP-labelled point datasets (flood-prone, low-lying, flood-vulnerable).
// Source KML lives in data/bbmp/; `npm run data:build` regenerates the
// GeoJSON served from public/data/. Unlike the illustrative risk scores in
// lib/demo.ts, these are reference locations, not current flood observations.

export type BbmpLayerId = "flood-prone" | "low-lying" | "flood-vulnerable";

export type BbmpPoint = {
  id: number;
  name: string;
  lat: number;
  lng: number;
  ward?: string;
  wardNo?: number;
  zone?: string;
};

export type BbmpLayer = {
  id: BbmpLayerId;
  label: string;
  description: string;
  color: string;
  url: string;
};

export const BBMP_LAYERS: BbmpLayer[] = [
  {
    id: "flood-prone",
    label: "Flood-prone",
    description: "Locations BBMP lists as prone to flooding",
    color: "#7c3aed",
    url: "/data/flood-prone.geojson",
  },
  {
    id: "low-lying",
    label: "Low-lying",
    description: "Low-lying areas identified by BBMP",
    color: "#0284c7",
    url: "/data/low-lying.geojson",
  },
  {
    id: "flood-vulnerable",
    label: "Flood-vulnerable",
    description: "BBMP flood-vulnerable locations with ward and zone",
    color: "#0f172a",
    url: "/data/flood-vulnerable.geojson",
  },
];

export const getBbmpLayer = (id: BbmpLayerId) =>
  BBMP_LAYERS.find((l) => l.id === id) ?? BBMP_LAYERS[0];

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

// Validates a GeoJSON FeatureCollection of Points, dropping malformed features.
export function parseBbmpGeoJson(input: unknown): BbmpPoint[] {
  if (!isRecord(input) || input.type !== "FeatureCollection" || !Array.isArray(input.features))
    throw new Error("Not a GeoJSON FeatureCollection");
  const points: BbmpPoint[] = [];
  for (const f of input.features) {
    if (!isRecord(f) || f.type !== "Feature" || !isRecord(f.geometry) || !isRecord(f.properties))
      continue;
    const { type, coordinates } = f.geometry;
    if (type !== "Point" || !Array.isArray(coordinates)) continue;
    const [lng, lat] = coordinates as unknown[];
    const p = f.properties;
    if (typeof lat !== "number" || typeof lng !== "number") continue;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (lat < 12.7 || lat > 13.3 || lng < 77.3 || lng > 77.9) continue;
    if (typeof p.name !== "string" || typeof p.id !== "number") continue;
    if (!p.name.trim() || !Number.isSafeInteger(p.id)) continue;
    points.push({
      id: p.id,
      name: p.name,
      lat,
      lng,
      ...(typeof p.ward === "string" ? { ward: p.ward } : {}),
      ...(typeof p.wardNo === "number" ? { wardNo: p.wardNo } : {}),
      ...(typeof p.zone === "string" ? { zone: p.zone } : {}),
    });
  }
  return points;
}

const cache = new Map<BbmpLayerId, Promise<BbmpPoint[]>>();

// Fetches a layer once per page load; failed loads are evicted so a retry refetches.
export function loadBbmpLayer(id: BbmpLayerId): Promise<BbmpPoint[]> {
  let pending = cache.get(id);
  if (!pending) {
    pending = fetch(getBbmpLayer(id).url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(parseBbmpGeoJson);
    pending.catch(() => cache.delete(id));
    cache.set(id, pending);
  }
  return pending;
}

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] as string,
  );

export function bbmpPopupHtml(layer: BbmpLayer, p: BbmpPoint) {
  const rows = [
    p.ward
      ? `Ward: ${escapeHtml(p.ward)}${p.wardNo ? ` (No. ${p.wardNo})` : ""}`
      : "",
    p.zone ? `Zone: ${escapeHtml(p.zone)}` : "",
    `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`,
  ].filter(Boolean);
  return `<div style="font:12px/1.45 system-ui,sans-serif;min-width:160px">
<div style="font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${layer.color}">BBMP · ${escapeHtml(layer.label)}</div>
<div style="font-weight:700;font-size:13px;margin:2px 0 4px;color:#0f172a">${escapeHtml(p.name)}</div>
${rows.map((r) => `<div style="color:#475569">${r}</div>`).join("")}
</div>`;
}
