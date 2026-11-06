import test from "node:test";
import assert from "node:assert/strict";
import {
  ZONES,
  ROADS,
  score,
  riskBreakdown,
  severity,
  findRoute,
} from "../lib/demo";
import {
  createSessionRepository,
  createApiRepository,
  validateReport,
  parseReports,
  reportAge,
} from "../lib/reports";

test("every supported scenario has a finite bounded score and matching breakdown", () => {
  for (const z of ZONES)
    for (const rainfall of [0, 10, 30, 55, 90])
      for (const minute of [0, 15, 30, 60]) {
        const result = riskBreakdown(z, { rainfall, minute }, []);
        assert.equal(score(z, { rainfall, minute }, []), result.total);
        assert.equal(
          result.raw,
          result.factors.reduce((sum, f) => sum + f.value, 0),
        );
        assert.ok(
          Number.isFinite(result.total) &&
            result.total >= 0 &&
            result.total <= 100,
        );
      }
});
test("blockage increases exposure; observations are capped and score saturates", () => {
  const observation = {
    id: "test",
    zone: "bellandur",
    cm: 50,
    blocked: false,
    note: "Observed",
    minutes: null,
  };
  const z = ZONES.find((z) => z.id === observation.zone)!;
  assert.ok(
    score(z, { rainfall: 30, minute: 0 }, [{ ...observation, blocked: true }]) >
      score(z, { rainfall: 30, minute: 0 }, [observation]),
  );
  const many = Array.from({ length: 100 }, () => observation);
  assert.equal(
    riskBreakdown(z, { rainfall: 90, minute: 20 }, many).factors.at(-1)?.value,
    20,
  );
  assert.equal(score(z, { rainfall: 90, minute: 20 }, many), 100);
  assert.deepEqual(
    [severity(34), severity(35), severity(64), severity(65)],
    ["low", "watch", "watch", "high"],
  );
});
test("routes use real graph edges and avoid a penalised intermediate zone when possible", () => {
  const risk = (id: string) => (id === "krp" ? 100 : 0);
  const shortest = findRoute("hebbal", "bellandur", false, risk),
    aware = findRoute("hebbal", "bellandur", true, risk);
  assert.ok(shortest.includes("krp"));
  assert.ok(!aware.includes("krp"));
  for (const path of [shortest, aware]) {
    assert.equal(path[0], "hebbal");
    assert.equal(path.at(-1), "bellandur");
    for (let i = 1; i < path.length; i++)
      assert.ok(
        ROADS.some(
          ([, a, b]) =>
            (a === path[i - 1] && b === path[i]) ||
            (b === path[i - 1] && a === path[i]),
        ),
      );
  }
  assert.deepEqual(findRoute("hebbal", "hebbal", true, risk), ["hebbal"]);
  assert.deepEqual(findRoute("missing", "bellandur", true, risk), []);
});
const input = {
  zone: "bellandur",
  cm: 25,
  blocked: true,
  note: "  Standing water  ",
};
test("session repository persists between instances and explicitly resets samples", async () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
  const first = createSessionRepository(storage);
  assert.equal((await first.list()).length, 3);
  const report = await first.create(input);
  assert.equal(report.note, "Standing water");
  assert.equal(report.source, "community");
  const second = createSessionRepository(storage);
  assert.ok((await second.list()).some((r) => r.id === report.id));
  assert.equal((await second.reset!()).length, 3);
});
test("invalid input, malformed stored data and blocked storage fail visibly", async () => {
  for (const patch of [
    { zone: "unknown" },
    { cm: NaN },
    { cm: -1 },
    { cm: 201 },
    { note: "x".repeat(401) },
    { blocked: "yes" },
  ])
    assert.throws(() => validateReport({ ...input, ...patch } as typeof input));
  assert.throws(() =>
    parseReports([{ ...input, id: "r", timestamp: "yesterday" }]),
  );
  const broken = createSessionRepository({
    getItem: () => "{invalid",
    setItem: () => {},
    removeItem: () => {},
  });
  await assert.rejects(() => broken.list());
  const denied = createSessionRepository({
    getItem: () => null,
    setItem: () => {
      throw new Error("Storage blocked");
    },
    removeItem: () => {},
  });
  await assert.rejects(() => denied.create(input), /Storage blocked/);
});
test("relative report age advances and future timestamps do not become negative", () => {
  const report = { ...input, id: "r", minutes: null, timestamp: 100000 };
  assert.equal(reportAge(report, 100000), "Just now");
  assert.equal(reportAge(report, 220000), "2 min ago");
  assert.equal(reportAge(report, 0), "Just now");
});
test("HTTP adapter uses documented paths and rejects service errors or invalid responses", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const request: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), init: init ?? {} });
    return Response.json(
      init?.method === "POST"
        ? { ...input, id: "saved", timestamp: 1000 }
        : [{ ...input, id: "saved", timestamp: 1000 }],
    );
  };
  const api = createApiRepository("https://example.test/api/", request);
  assert.equal((await api.list()).length, 1);
  assert.equal((await api.create(input)).id, "saved");
  assert.equal(calls[0].url, "https://example.test/api/reports");
  assert.equal(calls[1].init.method, "POST");
  assert.equal(calls[1].init.credentials, "include");
  await assert.rejects(
    () =>
      createApiRepository(
        "/api",
        async () => new Response(null, { status: 401 }),
      ).create(input),
    /Sign in/,
  );
  await assert.rejects(
    () =>
      createApiRepository("/api", async () =>
        Response.json({ unexpected: true }),
      ).list(),
    /not a list/,
  );
});
