"use client";
import { io } from "socket.io-client";
import {
  CloudRain,
  Droplets,
  MapPin,
  MessageSquare,
  RefreshCw,
  Radio,
} from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
type User = { id: string; name: string; role: "resident" | "admin" };
type Area = { slug: string; name: string };
type Report = {
  id: string;
  streetName: string;
  description: string;
  status: string;
  reportedWaterDepthCm: number;
  source: string;
  createdAt: string;
};
type Street = {
  id: string;
  name: string;
  currentWaterDepthCm: number | null;
  floodStatus: string;
  source: string;
  observedAt: string | null;
  landmark: string;
  drainageHealthScore: number | null;
  estimatedFloodTimeMins: number | null;
  potholes: {
    landmark: string;
    estimatedDepthCm: number;
    dangerRating: string;
  }[];
};
type Dashboard = {
  dataMode: string;
  simulationEnabled: boolean;
  summary: {
    totalMonitoredStreets: number;
    floodedOrImpassableCount: number;
    activeAreaReports: number;
  };
  streets: Street[];
  reports: Report[];
  weather: { source: string; rainfallMmPerHr: number | null };
};
async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const res = await fetch(`/api/street/${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const data = res.status === 204 ? null : await res.json();
  if (!res.ok) throw new Error(data?.message || "Request failed");
  return data;
}
export default function StreetMonitor() {
  const [refreshTick, setRefreshTick] = useState(0);
  const [connection, setConnection] = useState("Periodic updates");
  const [alerts, setAlerts] = useState<
    { timestamp: string; report?: Report; type: string }[]
  >([]);
  const [areas, setAreas] = useState<Area[]>([]),
    [area, setArea] = useState(""),
    [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [user, setUser] = useState<User | null>(null),
    [mine, setMine] = useState<Report[]>([]),
    [pending, setPending] = useState<Report[]>([]);
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [register, setRegister] = useState(false),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    api<{ data: Area[] }>("areas")
      .then((r) => {
        if (alive) {
          setAreas(r.data);
          setArea(r.data[0]?.slug || "");
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    api<{ user: User }>("auth/me")
      .then((r) => {
        if (alive) setUser(r.user);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    setAlerts([]);
    const url = process.env.NEXT_PUBLIC_STREET_SOCKET_URL;
    if (!url || !area) return;
    const socket = io(url, { transports: ["websocket"] });
    setConnection("Connecting alerts...");
    socket.on("connect", () => {
      socket.emit("joinArea", area);
      setConnection("Area alerts connected");
      setRefreshTick((n) => n + 1);
    });
    socket.on("disconnect", () =>
      setConnection("Reconnecting · periodic updates active"),
    );
    socket.on("connect_error", () =>
      setConnection("Alerts unavailable · periodic updates active"),
    );
    socket.on("areaAlert", (event) => {
      if (event.areaSlug !== area) return;
      setAlerts((items) => [event, ...items].slice(0, 10));
      setRefreshTick((n) => n + 1);
    });
    return () => {
      socket.emit("leaveArea", area);
      socket.disconnect();
    };
  }, [area]);
  const refreshPersonal = useCallback(async () => {
    if (!user) return;
    setMine((await api<{ data: Report[] }>("reports/mine")).data);
    if (user.role === "admin")
      setPending((await api<{ data: Report[] }>("reports/pending")).data);
  }, [user]);
  useEffect(() => {
    refreshPersonal().catch((e) => setError(e.message));
  }, [refreshPersonal]);
  useEffect(() => {
    if (!area) return;
    let alive = true;
    setDashboard(null);
    setLoading(true);
    const refresh = () =>
      api<Dashboard>(`areas/${area}`)
        .then((d) => {
          if (alive) {
            setDashboard(d);
            setError("");
          }
        })
        .catch((e) => {
          if (alive) setError(e.message);
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 15000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [area, refreshTick]);
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }
  function signIn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    void action(async () => {
      const r = await api<{ user: User }>(
        register ? "auth/register" : "auth/login",
        "POST",
        Object.fromEntries(form),
      );
      setUser(r.user);
      setMessage("Signed in.");
    });
  }
  function report(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fields = Object.fromEntries(new FormData(form));
    void action(async () => {
      await api("reports", "POST", {
        ...fields,
        areaSlug: area,
        reportedWaterDepthCm: Number(fields.reportedWaterDepthCm),
      });
      form.reset();
      setMessage(
        "Report saved for review. It will affect street conditions after approval.",
      );
      await refreshPersonal();
    });
  }
  async function moderate(id: string, status: string) {
    await api(`reports/${id}/status`, "PATCH", { status });
    await refreshPersonal();
    if (area) setDashboard(await api<Dashboard>(`areas/${area}`));
    setMessage(`Report ${status}.`);
  }
  return (
    <section className="space-y-6" aria-label="Neighbourhood conditions">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800">
          <Radio size={14} />
          {connection}
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn-secondary"
            disabled={busy || !area}
            onClick={() => setRefreshTick((n) => n + 1)}
          >
            <RefreshCw size={15} />
            Refresh data
          </button>
          <button
            className="btn-primary"
            disabled={
              busy || !dashboard?.simulationEnabled || user?.role !== "admin"
            }
            onClick={() =>
              void action(async () => {
                await api(`ai/simulate-rain/${area}`, "POST", {});
                setRefreshTick((n) => n + 1);
                setMessage("Synthetic cloudburst saved for this area.");
              })
            }
          >
            <CloudRain size={15} />
            Simulate cloudburst
          </button>
        </div>
      </div>
      <p className="text-xs text-slate-500">
        Cloudburst simulation is available to reviewers in an isolated demo. It
        never creates real weather observations.
      </p>
      <p className="text-sm text-slate-600">
        Conditions are based on moderated community reports, valid for 24 hours.
        Unknown means no current observation. This is not a safe-travel
        guarantee. Updates refresh every 15 seconds.
      </p>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-500/50 p-4 text-red-700"
        >
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="rounded-xl border border-emerald-500/50 p-4 text-emerald-700"
        >
          {message}
        </p>
      )}
      {dashboard && (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            {
              label: "Monitored streets",
              value: dashboard.summary.totalMonitoredStreets,
              icon: MapPin,
            },
            {
              label: "Flooded / impassable",
              value: dashboard.summary.floodedOrImpassableCount,
              icon: Droplets,
            },
            {
              label: "Rainfall",
              value:
                dashboard.weather.rainfallMmPerHr === null
                  ? "Unavailable"
                  : `${dashboard.weather.rainfallMmPerHr} mm/h`,
              icon: CloudRain,
            },
            {
              label: "Active observations",
              value: dashboard.summary.activeAreaReports,
              icon: MessageSquare,
            },
          ].map(({ label, value, icon: Icon }) => (
            <div className="panel p-5" key={label}>
              <Icon size={19} className="mb-4 text-blue-600" />
              <p className="text-xs text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-extrabold text-slate-800">
                {value}
              </p>
            </div>
          ))}
        </div>
      )}
      <section className="panel space-y-4 p-5" aria-label="Area conditions">
        <label className="block">
          Area
          <select
            className="field mt-2"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            disabled={!areas.length}
          >
            {areas.map((a) => (
              <option key={a.slug} value={a.slug}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        {loading && <p role="status">Loading conditions…</p>}
        {!loading && !areas.length && !error && (
          <p>No areas have been imported yet.</p>
        )}
        {dashboard && (
          <>
            <p className="text-sm">
              {dashboard.dataMode === "synthetic"
                ? "DEMO: synthetic sample data."
                : "Community observation mode."}{" "}
              Rainfall:{" "}
              {dashboard.weather.rainfallMmPerHr === null
                ? "Unavailable"
                : `${dashboard.weather.rainfallMmPerHr} mm/h`}{" "}
              · {dashboard.weather.source}
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {dashboard.streets.map((s) => (
                <article
                  className="rounded-xl border border-slate-200 p-4"
                  key={s.id}
                >
                  <h2 className="font-semibold">{s.name}</h2>
                  <p className="mt-1 text-xs text-slate-500">{s.landmark}</p>
                  <p className="mt-2">
                    {s.floodStatus.replaceAll("_", " ")} ·{" "}
                    {s.currentWaterDepthCm === null
                      ? "No current reading"
                      : `${s.currentWaterDepthCm} cm reported water depth`}
                  </p>
                  <dl className="my-4 grid grid-cols-3 gap-3 rounded-lg bg-slate-50 p-3 text-xs">
                    <div>
                      <dt className="text-slate-500">Drainage score</dt>
                      <dd className="mt-1 font-bold">
                        {s.drainageHealthScore === null
                          ? "Unknown"
                          : `${s.drainageHealthScore}/100`}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Potholes</dt>
                      <dd className="mt-1 font-bold">
                        {dashboard.dataMode === "synthetic"
                          ? s.potholes.length
                          : "Unsurveyed"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Formula ETA</dt>
                      <dd className="mt-1 font-bold">
                        {s.estimatedFloodTimeMins === null
                          ? "Unavailable"
                          : `${s.estimatedFloodTimeMins} min`}
                      </dd>
                    </div>
                  </dl>
                  {s.potholes.length > 0 && (
                    <details className="mb-3 text-xs">
                      <summary className="cursor-pointer font-semibold text-blue-700">
                        Pothole details
                      </summary>
                      {s.potholes.map((p, i) => (
                        <p className="mt-2" key={i}>
                          {p.landmark} · {p.estimatedDepthCm} cm example depth ·{" "}
                          {p.dangerRating.replaceAll("_", " ")}
                        </p>
                      ))}
                    </details>
                  )}
                  {dashboard.dataMode === "synthetic" && (
                    <p className="mb-3 text-xs text-amber-800">
                      Drainage, potholes and ETA are synthetic scenario values,
                      not measured conditions or validated forecasts.
                    </p>
                  )}
                  <p className="mt-1 text-xs text-slate-600">
                    Source: {s.source}
                    {s.observedAt
                      ? ` · ${new Date(s.observedAt).toLocaleString()}`
                      : ""}
                  </p>
                </article>
              ))}
            </div>
            {!dashboard.streets.length && (
              <p>No streets registered for this area.</p>
            )}
          </>
        )}
      </section>
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="panel p-5">
          <h2 className="text-lg font-extrabold text-slate-800">
            Community observations
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Confirmed observations for the selected area.
          </p>
          {!dashboard?.reports.length && (
            <p className="mt-4 text-sm text-slate-500">
              No active observations in this area.
            </p>
          )}
          {dashboard?.reports.map((r) => (
            <article key={r.id} className="mt-4 border-t border-slate-100 pt-4">
              <h3 className="text-sm font-bold">{r.streetName}</h3>
              <p className="mt-1 text-sm text-slate-600">{r.description}</p>
              <p className="mt-2 text-xs text-slate-500">
                {r.reportedWaterDepthCm} cm · {r.source} ·{" "}
                {new Date(r.createdAt).toLocaleString()}
              </p>
            </article>
          ))}
        </section>
        <section className="panel p-5">
          <h2 className="text-lg font-extrabold text-slate-800">
            Area alert stream
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            New events for this area during your visit.
          </p>
          <div aria-live="polite">
            {!alerts.length && (
              <p className="mt-4 text-sm text-slate-500">
                No new alerts. Confirmed reports and demo cloudbursts appear
                here when alerts are connected.
              </p>
            )}
            {alerts.map((event, i) => (
              <article
                key={event.timestamp + i}
                className="mt-4 rounded-lg bg-blue-50 p-3"
              >
                <h3 className="text-sm font-bold">
                  {event.report?.streetName || "Area update"}
                </h3>
                <p className="mt-1 text-sm">
                  {event.report?.description || event.type}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>
      {!user ? (
        <section className="panel p-5">
          <h2 className="text-xl font-semibold">
            {register ? "Create an account" : "Sign in to report"}
          </h2>
          <form onSubmit={signIn} className="mt-4 grid gap-3 sm:grid-cols-2">
            {register && (
              <label>
                Name
                <input
                  className="field"
                  name="name"
                  required
                  maxLength={80}
                  autoComplete="name"
                />
              </label>
            )}
            <label>
              Email
              <input
                className="field"
                name="email"
                type="email"
                required
                autoComplete="email"
              />
            </label>
            <label>
              Password
              <input
                className="field"
                name="password"
                type="password"
                required
                minLength={register ? 12 : 1}
                maxLength={128}
                autoComplete={register ? "new-password" : "current-password"}
              />
            </label>
            <button className="btn-primary self-end" disabled={busy}>
              {register ? "Create account" : "Sign in"}
            </button>
          </form>
          <button
            type="button"
            className="mt-4 text-blue-700 underline"
            onClick={() => setRegister(!register)}
          >
            {register
              ? "Already registered? Sign in"
              : "New contributor? Create an account"}
          </button>
        </section>
      ) : (
        <>
          <section className="panel space-y-4 p-5">
            <div className="flex justify-between">
              <h2 className="text-xl font-semibold">
                Report an observation · {user.name}
              </h2>
              <button
                disabled={busy}
                className="btn-secondary"
                onClick={() =>
                  void action(async () => {
                    await api("auth/logout", "POST", {});
                    setUser(null);
                    setMine([]);
                    setPending([]);
                  })
                }
              >
                Sign out
              </button>
            </div>
            <form
              key={area}
              onSubmit={report}
              className="grid gap-4 sm:grid-cols-2"
            >
              <label>
                Street
                <select
                  name="streetId"
                  className="field"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select street
                  </option>
                  {dashboard?.streets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Observation type
                <select name="reportType" className="field">
                  <option value="FLOODING">Flooding</option>
                  <option value="POTHOLE">Pothole</option>
                  <option value="DRAIN_BLOCKAGE">Drain blockage</option>
                  <option value="TRAFFIC_STUCK">Traffic stuck</option>
                </select>
              </label>
              <label>
                Observed water depth (cm)
                <input
                  name="reportedWaterDepthCm"
                  type="number"
                  step="0.1"
                  min="0"
                  max="200"
                  required
                  className="field"
                />
              </label>
              <label>
                Description
                <textarea
                  className="field"
                  name="description"
                  required
                  maxLength={500}
                />
              </label>
              <button
                className="btn-primary"
                disabled={busy || !dashboard?.streets.length}
              >
                Submit for review
              </button>
            </form>
          </section>
          <section className="panel p-5">
            <h2 className="text-xl font-semibold">My submissions</h2>
            {mine.length ? (
              mine.map((r) => (
                <p key={r.id} className="mt-3">
                  {r.streetName} · {r.reportedWaterDepthCm} cm · {r.status}
                </p>
              ))
            ) : (
              <p className="mt-3">No reports yet.</p>
            )}
          </section>
          {user.role === "admin" && (
            <section className="panel p-5">
              <h2 className="text-xl font-semibold">Review pending reports</h2>
              {!pending.length && (
                <p className="mt-3">No reports awaiting review.</p>
              )}
              {pending.map((r) => (
                <article
                  key={r.id}
                  className="mt-4 space-y-2 border-t border-slate-200 pt-4"
                >
                  <h3>
                    {r.streetName} · {r.reportedWaterDepthCm} cm
                  </h3>
                  <p>{r.description}</p>
                  <div className="flex gap-3">
                    <button
                      className="btn-primary"
                      disabled={busy}
                      onClick={() =>
                        void action(() => moderate(r.id, "confirmed"))
                      }
                    >
                      Confirm
                    </button>
                    <button
                      className="btn-secondary"
                      disabled={busy}
                      onClick={() =>
                        void action(() => moderate(r.id, "rejected"))
                      }
                    >
                      Reject
                    </button>
                  </div>
                </article>
              ))}
            </section>
          )}
        </>
      )}
    </section>
  );
}
