#!/usr/bin/env node
// Converts the BBMP point datasets in data/bbmp/*.kml into compact GeoJSON
// served from public/data/. Run with: npm run data:build
//
// The KML files are simple OGR exports (one <Point> per <Placemark> plus
// <SimpleData> attributes), so a small regex parser is enough and avoids a
// runtime dependency. Points with missing/NaN coordinates or outside the
// Bengaluru bounding box are skipped and reported.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATASETS = [
  {
    id: "flood-prone",
    file: "flood-prone.kml",
    title: "BBMP flood-prone locations",
  },
  { id: "low-lying", file: "low-lying.kml", title: "BBMP low-lying areas" },
  {
    id: "flood-vulnerable",
    file: "flood-vulnerable.kml",
    title: "BBMP flood-vulnerable locations",
  },
];
// Generous box around Bengaluru urban district.
const BOUNDS = { minLat: 12.7, maxLat: 13.3, minLng: 77.3, maxLng: 77.9 };

const decode = (s) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");

// Collapse whitespace/newlines, tidy commas, and title-case names that are
// entirely upper or lower case so labels read consistently on the map.
function cleanName(raw) {
  let s = decode(raw)
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/[\s,]+$/, "")
    .trim();
  if (s === s.toUpperCase() || s === s.toLowerCase()) {
    s = s
      .toLowerCase()
      .replace(/(^|[\s,(/-])(\p{L})/gu, (_, p, c) => p + c.toUpperCase());
  } else if (/^\p{Ll}/u.test(s)) {
    s = s[0].toUpperCase() + s.slice(1);
  }
  return s;
}

function parse(kml) {
  const features = [];
  const skipped = [];
  for (const [, body] of kml.matchAll(
    /<Placemark\b[^>]*>([\s\S]*?)<\/Placemark>/g,
  )) {
    const data = {};
    for (const [, key, value] of body.matchAll(
      /<SimpleData name="([^"]+)">([\s\S]*?)<\/SimpleData>/g,
    ))
      data[key] = decode(value).trim();
    const nameTag = body.match(/<name>([\s\S]*?)<\/name>/)?.[1];
    const name = cleanName(nameTag ?? data.LocationName ?? "Unnamed location");
    const coords = body
      .match(/<coordinates>([\s\S]*?)<\/coordinates>/)?.[1]
      .trim()
      .split(",");
    const lng = Number(coords?.[0]);
    const lat = Number(coords?.[1]);
    const id = Number(data.OBJECTID);
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < BOUNDS.minLat ||
      lat > BOUNDS.maxLat ||
      lng < BOUNDS.minLng ||
      lng > BOUNDS.maxLng
    ) {
      skipped.push(`${id}: ${name}`);
      continue;
    }
    const properties = { id, name };
    if (data.WARD_NAME) properties.ward = cleanName(data.WARD_NAME);
    if (data.WARDNO && Number.isFinite(Number(data.WARDNO)))
      properties.wardNo = Number(data.WARDNO);
    if (data.ZONE) properties.zone = cleanName(data.ZONE);
    features.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [+lng.toFixed(6), +lat.toFixed(6)],
      },
      properties,
    });
  }
  return { features, skipped };
}

mkdirSync(join(root, "public/data"), { recursive: true });
for (const ds of DATASETS) {
  const kml = readFileSync(join(root, "data/bbmp", ds.file), "utf8");
  const { features, skipped } = parse(kml);
  const out = {
    type: "FeatureCollection",
    name: ds.id,
    title: ds.title,
    source: "BBMP (Bruhat Bengaluru Mahanagara Palike) open data, KML export",
    features,
  };
  writeFileSync(
    join(root, "public/data", `${ds.id}.geojson`),
    JSON.stringify(out) + "\n",
  );
  console.log(
    `${ds.id}: ${features.length} points` +
      (skipped.length
        ? `, skipped ${skipped.length} (${skipped.join("; ")})`
        : ""),
  );
}
