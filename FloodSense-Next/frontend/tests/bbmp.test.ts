import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BBMP_LAYERS, parseBbmpGeoJson, bbmpPopupHtml } from "../lib/bbmp";

const load = (id: string) =>
  JSON.parse(
    readFileSync(
      join(__dirname, "..", "public", "data", `${id}.geojson`),
      "utf8",
    ),
  );

test("every BBMP layer ships valid points inside Bengaluru", () => {
  const expected = {
    "flood-prone": 70,
    "low-lying": 128,
    "flood-vulnerable": 200,
  };
  for (const layer of BBMP_LAYERS) {
    const points = parseBbmpGeoJson(load(layer.id));
    assert.equal(points.length, expected[layer.id], layer.id);
    for (const p of points) {
      assert.ok(p.lat > 12.7 && p.lat < 13.3, `${layer.id} ${p.id} lat`);
      assert.ok(p.lng > 77.3 && p.lng < 77.9, `${layer.id} ${p.id} lng`);
      assert.ok(p.name.length > 0 && !/\n/.test(p.name));
    }
  }
});
test("flood-vulnerable points carry ward number and zone attributes", () => {
  const points = parseBbmpGeoJson(load("flood-vulnerable"));
  // Source record 178 (Shambhavinagar) has no WARD_NAME, so only zone and
  // ward number are required on every point.
  assert.ok(points.every((p) => p.zone && p.wardNo));
  assert.ok(points.filter((p) => p.ward).length >= 199);
});
test("parser drops malformed features and rejects non-collections", () => {
  assert.throws(() => parseBbmpGeoJson({ type: "Feature" }));
  const points = parseBbmpGeoJson({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [77.6, 12.9] },
        properties: { id: 1, name: "ok" },
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [null, null] },
        properties: { id: 2, name: "nan" },
      },
      {
        type: "Feature",
        geometry: { type: "LineString", coordinates: [] },
        properties: { id: 3, name: "line" },
      },
      null,
    ],
  });
  assert.deepEqual(
    points.map((p) => p.id),
    [1],
  );
});
test("popup escapes HTML in names", () => {
  const html = bbmpPopupHtml(BBMP_LAYERS[0], {
    id: 1,
    name: "<b>x</b>",
    lat: 12.9,
    lng: 77.6,
  });
  assert.ok(
    html.includes("&lt;b&gt;x&lt;/b&gt;") && !html.includes("<b>x</b>"),
  );
});
