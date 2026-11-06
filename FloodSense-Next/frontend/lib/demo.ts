export type Zone = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  history: number;
  vulnerability: number;
  ground: string;
};
export type Report = {
  id: string;
  zone: string;
  cm: number;
  blocked: boolean;
  note: string;
  minutes: number | null;
  timestamp?: number;
  source?: "sample" | "community";
};
export type Scenario = { rainfall: number; minute: number };
export const ZONES: Zone[] = [
  {
    id: "hebbal",
    name: "Hebbal Flyover",
    lat: 13.0358,
    lng: 77.597,
    history: 0.8,
    vulnerability: 0.8,
    ground: "Low",
  },
  {
    id: "krp",
    name: "KR Puram",
    lat: 13.0077,
    lng: 77.6957,
    history: 0.7,
    vulnerability: 0.6,
    ground: "Medium",
  },
  {
    id: "whitefield",
    name: "Whitefield",
    lat: 12.9698,
    lng: 77.75,
    history: 0.6,
    vulnerability: 0.6,
    ground: "Medium",
  },
  {
    id: "marathahalli",
    name: "Marathahalli",
    lat: 12.9592,
    lng: 77.6974,
    history: 0.7,
    vulnerability: 0.7,
    ground: "Low",
  },
  {
    id: "bellandur",
    name: "Bellandur",
    lat: 12.9304,
    lng: 77.6784,
    history: 1,
    vulnerability: 1,
    ground: "Very low",
  },
  {
    id: "varthur",
    name: "Varthur",
    lat: 12.9387,
    lng: 77.7417,
    history: 0.9,
    vulnerability: 0.9,
    ground: "Very low",
  },
];
export const ROADS: [string, string, string][] = [
  ["Outer Ring Road (North)", "hebbal", "krp"],
  ["Outer Ring Road (East)", "krp", "marathahalli"],
  ["Outer Ring Road (South)", "marathahalli", "bellandur"],
  ["Whitefield Main Road", "krp", "whitefield"],
  ["Varthur Road", "marathahalli", "varthur"],
  ["Bellandur–Varthur Link", "bellandur", "varthur"],
  ["Hennur–Whitefield Corridor", "hebbal", "whitefield"],
  ["Whitefield–Varthur Road", "whitefield", "varthur"],
  ["Kasavanahalli Bypass", "krp", "bellandur"],
];
export const INITIAL_REPORTS: Report[] = [
  {
    id: "r1",
    zone: "bellandur",
    cm: 25,
    blocked: true,
    note: "Waterlogging reported along the service road; drain appears clogged.",
    minutes: 12,
  },
  {
    id: "r2",
    zone: "hebbal",
    cm: 10,
    blocked: false,
    note: "Water pooling beneath the flyover.",
    minutes: 27,
  },
  {
    id: "r3",
    zone: "varthur",
    cm: 50,
    blocked: false,
    note: "Standing water reported near the lake-side access road.",
    minutes: 48,
  },
];
export const getZone = (id: string) =>
  ZONES.find((z) => z.id === id) ?? ZONES[0];
export function rainfallAt(s: Scenario, minute = s.minute) {
  return s.rainfall * Math.exp(-Math.pow((minute - 20) / 22, 2));
}
export function accumulation(s: Scenario, minute = s.minute) {
  let a = 0;
  for (let t = -30; t <= minute; t += 5) a += (rainfallAt(s, t) * 5) / 60;
  return a;
}
export function riskBreakdown(z: Zone, s: Scenario, reps: Report[]) {
  const rr = reps.filter((r) => r.zone === z.id),
    blocked = rr.some((r) => r.blocked);
  const history = z.history * 16,
    rain = z.vulnerability * rainfallAt(s) * 0.7,
    water = z.vulnerability * accumulation(s) * 2.2;
  const drainage = blocked ? (rain + water) * 0.35 + 6 : 0,
    observations = Math.min(
      20,
      rr.reduce((a, r) => a + (r.cm >= 40 ? 10 : r.cm >= 20 ? 6 : 3), 0),
    );
  const factors = [
    { label: "Sample flood history", value: history },
    { label: "Rainfall exposure", value: rain },
    { label: "Accumulated rainfall", value: water },
    { label: "Reported drainage blockage", value: drainage },
    { label: "Community observations", value: observations },
  ];
  const raw = factors.reduce((sum, f) => sum + f.value, 0);
  return { factors, raw, total: Math.max(0, Math.min(100, Math.round(raw))) };
}
export function score(z: Zone, s: Scenario, reps: Report[]) {
  return riskBreakdown(z, s, reps).total;
}
export const severity = (n: number): "high" | "watch" | "low" =>
  n >= 65 ? "high" : n >= 35 ? "watch" : "low";
export const severityLabel = (n: number) =>
  n >= 65 ? "High risk" : n >= 35 ? "Under watch" : "Low risk";
export const scenarioChoices = [
  { value: 0, label: "Dry conditions" },
  { value: 10, label: "Light rain" },
  { value: 30, label: "Moderate rainfall" },
  { value: 55, label: "Heavy rainfall" },
  { value: 90, label: "Cloudburst" },
];
export function findRoute(
  from: string,
  to: string,
  aware: boolean,
  getRisk: (id: string) => number,
) {
  const d: Record<string, number> = {},
    prev: Record<string, string> = {},
    visited = new Set<string>();
  ZONES.forEach((z) => (d[z.id] = Infinity));
  d[from] = 0;
  for (let i = 0; i < ZONES.length; i++) {
    const u = ZONES.filter((z) => !visited.has(z.id)).sort(
      (a, b) => d[a.id] - d[b.id],
    )[0]?.id;
    if (!u || !Number.isFinite(d[u])) break;
    visited.add(u);
    ROADS.forEach(([, a, b]) => {
      const v = a === u ? b : b === u ? a : null;
      if (!v) return;
      const za = getZone(u),
        zb = getZone(v),
        dist = Math.hypot((za.lat - zb.lat) * 111, (za.lng - zb.lng) * 108),
        risk = Math.max(getRisk(u), getRisk(v));
      const cost =
        dist + (aware ? (risk >= 65 ? 500 : risk >= 35 ? dist * 0.7 : 0) : 0);
      if (d[u] + cost < d[v]) {
        d[v] = d[u] + cost;
        prev[v] = u;
      }
    });
  }
  let path = [to];
  while (path[0] !== from && prev[path[0]]) path = [prev[path[0]], ...path];
  return path[0] === from ? path : [];
}
export function routeEstimate(path: string[], getRisk: (id: string) => number) {
  let n = 0;
  for (let i = 1; i < path.length; i++) {
    const a = getZone(path[i - 1]),
      b = getZone(path[i]),
      dist = Math.hypot((a.lat - b.lat) * 111, (a.lng - b.lng) * 108),
      r = Math.max(getRisk(a.id), getRisk(b.id));
    n += dist * 2.5 + (r >= 65 ? 25 : r >= 35 ? 6 : 0);
  }
  return Math.round(n);
}
// Future backend adapter contract. Currently all functions are deterministic frontend simulations.
export const DEMO_MODE = true;
