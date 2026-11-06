"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  Activity,
  ArrowDownUp,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  CloudRain,
  Database,
  Download,
  Droplets,
  FileText,
  Info,
  LayoutDashboard,
  Map,
  MapPin,
  Menu,
  Plus,
  Route,
  ShieldCheck,
  SlidersHorizontal,
  TriangleAlert,
  Users,
} from "lucide-react";
import {
  ZONES,
  ROADS,
  score,
  severity,
  severityLabel,
  rainfallAt,
  getZone,
  scenarioChoices,
  findRoute,
  routeEstimate,
  type Report,
  type Scenario,
} from "../lib/demo";
import {
  createSessionRepository,
  createApiRepository,
  reportAge,
  type ReportRepository,
  type ReportInput,
} from "../lib/reports";
import ReportDialog from "./ReportDialog";
import RiskExplanation from "./RiskExplanation";
const RiskMap = dynamic(() => import("./RiskMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[400px] items-center justify-center bg-[#eef3f7] text-sm text-slate-500">
      Preparing interactive map…
    </div>
  ),
});
type View = "overview" | "explorer" | "routes" | "reports" | "operations";
const nav = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "explorer", label: "Risk explorer", icon: Map },
  { id: "routes", label: "Route intelligence", icon: Route },
  { id: "reports", label: "Community reports", icon: Users },
  { id: "operations", label: "City operations", icon: Activity },
] as const;
const headings: Record<View, [string, string]> = {
  overview: [
    "City overview",
    "A clearer picture of flood exposure, right down to your route.",
  ],
  explorer: [
    "Risk explorer",
    "Explore scenario-based flood exposure across Bengaluru.",
  ],
  routes: [
    "Route intelligence",
    "Compare example paths using predicted flood exposure.",
  ],
  reports: [
    "Community reports",
    "Local observations that add context to a changing city.",
  ],
  operations: [
    "City operations",
    "A conceptual workspace for planning response coordination.",
  ],
};
function RiskBadge({ value }: { value: number }) {
  return (
    <span className={`status-pill status-${severity(value)}`}>
      {severityLabel(value)}
    </span>
  );
}
function SectionHeading({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-[16px] font-extrabold text-slate-800">{title}</h2>
        {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
      </div>
      {action}
    </div>
  );
}
function ZoneSelect({
  value,
  onChange,
  all = false,
  label = "Location",
}: {
  value: string;
  onChange: (s: string) => void;
  all?: boolean;
  label?: string;
}) {
  return (
    <select
      aria-label={label}
      className="field"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {all && <option value="all">All locations</option>}
      {ZONES.map((z) => (
        <option value={z.id} key={z.id}>
          {z.name}
        </option>
      ))}
    </select>
  );
}
function Metric({
  icon: Icon,
  label,
  value,
  foot,
  color = "blue",
}: {
  icon: typeof Activity;
  label: string;
  value: string | number;
  foot: string;
  color?: string;
}) {
  return (
    <div className="panel px-5 py-5">
      <div className="flex items-start justify-between">
        <span className="text-[12px] font-semibold text-slate-500">
          {label}
        </span>
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-xl ${color === "red" ? "bg-rose-50 text-rose-600" : color === "amber" ? "bg-amber-50 text-amber-600" : color === "green" ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"}`}
        >
          <Icon size={18} />
        </span>
      </div>
      <div className="mt-2 text-[31px] font-extrabold leading-none tracking-tight text-slate-800">
        {value}
      </div>
      <p className="mt-3 text-[11px] text-slate-500">{foot}</p>
    </div>
  );
}
export default function Dashboard() {
  const [view, setView] = useState<View>("overview"),
    [sidebar, setSidebar] = useState(false),
    [scenario, setScenario] = useState<Scenario>({ rainfall: 30, minute: 0 }),
    [selected, setSelected] = useState("bellandur");
  const [reports, setReports] = useState<Report[]>([]),
    [assigned, setAssigned] = useState<string[]>([]),
    [modal, setModal] = useState(false),
    [filterZone, setFilterZone] = useState("all"),
    [filterDepth, setFilterDepth] = useState("all"),
    [from, setFrom] = useState("hebbal"),
    [to, setTo] = useState("varthur"),
    [toast, setToast] = useState("");
  const [now, setNow] = useState(0),
    [loading, setLoading] = useState(true),
    [reportError, setReportError] = useState("");
  const repository = useRef<ReportRepository | null>(null),
    toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  const loadReports = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setReportError("");
      try {
        if (!repository.current)
          repository.current = apiBase
            ? createApiRepository(apiBase)
            : createSessionRepository(window.sessionStorage);
        const rows = await repository.current.list(signal);
        if (!signal?.aborted) setReports(rows);
      } catch (error) {
        if (!signal?.aborted)
          setReportError(
            error instanceof Error
              ? error.message
              : "Reports could not be loaded.",
          );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [apiBase],
  );
  useEffect(() => {
    const controller = new AbortController();
    void loadReports(controller.signal);
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => {
      controller.abort();
      clearInterval(timer);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [loadReports]);
  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3800);
  }, []);
  const getRisk = useCallback(
    (id: string) => score(getZone(id), scenario, reports),
    [scenario, reports],
  );
  const risks = useMemo(
    () => Object.fromEntries(ZONES.map((z) => [z.id, getRisk(z.id)])),
    [getRisk],
  );
  const riskList = useMemo(
    () =>
      ZONES.map((z) => ({ ...z, risk: risks[z.id] })).sort(
        (a, b) => b.risk - a.risk,
      ),
    [risks],
  );
  const highCount = riskList.filter((z) => z.risk >= 65).length,
    watchCount = riskList.filter((z) => z.risk >= 35 && z.risk < 65).length;
  const normal = useMemo(
      () => findRoute(from, to, false, getRisk),
      [from, to, getRisk],
    ),
    safer = useMemo(
      () => findRoute(from, to, true, getRisk),
      [from, to, getRisk],
    );
  const worst = (ids: string[]) =>
    ids.length ? Math.max(...ids.map((id) => risks[id])) : 0;
  const filtered = reports.filter(
    (r) =>
      (filterZone === "all" || filterZone === r.zone) &&
      (filterDepth === "all" ||
        (filterDepth === "minor" && r.cm < 20) ||
        (filterDepth === "moderate" && r.cm >= 20 && r.cm < 40) ||
        (filterDepth === "severe" && r.cm >= 40)),
  );
  const openView = (v: View) => {
    setView(v);
    setSidebar(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const downloadCsv = () => {
    const header = [
      "Area",
      "Latitude",
      "Longitude",
      "Risk score",
      "Severity",
      "Community reports",
      "Blocked drain",
    ];
    const rows = ZONES.map((z) => [
      z.name,
      z.lat,
      z.lng,
      risks[z.id],
      severityLabel(risks[z.id]),
      reports.filter((r) => r.zone === z.id).length,
      reports.some((r) => r.zone === z.id && r.blocked),
    ]);
    const csv = [header, ...rows]
      .map((row) =>
        row.map((x) => `"${String(x).replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "floodsense-demo-snapshot.csv";
    a.click();
    URL.revokeObjectURL(url);
    notify("Demo CSV exported successfully.");
  };
  const addReport = async (input: ReportInput) => {
    if (!repository.current)
      throw new Error("Report storage is not ready. Retry loading reports.");
    const saved = await repository.current.create(input);
    setReports((rows) => [saved, ...rows]);
    setNow(Date.now());
    notify(
      apiBase
        ? "Report saved by the report service."
        : "Report saved in this browser tab. Nothing was sent to a server.",
    );
  };
  const apiExample = {
    mode: "demo",
    forecast_minutes: scenario.minute,
    scenario_rain_mm_hr: scenario.rainfall,
    avoid_zones: riskList
      .filter((z) => z.risk >= 35)
      .map((z) => ({
        zone_id: z.id,
        latitude: z.lat,
        longitude: z.lng,
        risk: z.risk,
        level: severity(z.risk),
      })),
    blocked_roads: ROADS.filter(
      ([, a, b]) => Math.max(risks[a], risks[b]) >= 65,
    ).map((r) => r[0]),
  };
  return (
    <div className="min-h-screen lg:flex">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {sidebar && (
        <button
          className="fixed inset-0 z-[999] bg-slate-950/50 lg:hidden"
          aria-label="Close navigation"
          onClick={() => setSidebar(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-[1000] flex w-[255px] flex-col bg-[#101d30] text-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${sidebar ? "visible translate-x-0" : "invisible -translate-x-full"} lg:visible`}
      >
        <div className="flex h-[89px] items-center gap-3 border-b border-white/10 px-6">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-sky-300">
            <Droplets size={26} strokeWidth={2.4} />
          </span>
          <div>
            <div className="text-[21px] font-extrabold tracking-tight">
              flood<span className="font-normal text-[#93a9c5]">sense</span>
            </div>
            <div className="text-[9px] font-semibold tracking-[.17em] text-[#94a6bc]">
              URBAN INTELLIGENCE
            </div>
          </div>
        </div>
        <div className="px-4 pt-8">
          <div className="mb-4 px-3 text-[10px] font-semibold tracking-[.18em] text-[#7f95b2]">
            WORKSPACE
          </div>
          <nav
            id="primary-navigation"
            aria-label="Primary navigation"
            className="space-y-1"
          >
            {nav.map(({ id, label, icon: Icon }) => (
              <button
                aria-current={view === id ? "page" : undefined}
                key={id}
                onClick={() => openView(id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-semibold transition ${view === id ? "bg-[#263c5d] text-white" : "text-[#9badc3] hover:bg-white/5 hover:text-white"}`}
              >
                <Icon size={18} />
                {label}
                {id === "reports" && (
                  <span className="ml-auto rounded-md bg-white/10 px-1.5 text-[10px]">
                    {reports.length}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
        <div className="mt-auto px-4 pb-6">
          <div className="mb-5 rounded-xl border border-white/10 bg-white/[.045] p-4">
            <div className="flex items-center gap-2 text-[12px] font-semibold">
              <span className="h-2 w-2 rounded-full bg-sky-400" /> Demonstration
              mode
            </div>
            <div className="mt-1 pl-4 text-[11px] text-[#93a6bd]">
              No live data or active sensors
            </div>
          </div>
          <button
            onClick={() =>
              notify(
                "FloodSense is an interactive frontend concept, not an emergency alert service.",
              )
            }
            className="flex w-full items-center gap-2 px-2 py-2 text-left text-xs text-[#a6b6ca] hover:text-white"
          >
            <Info size={16} /> About this prototype
          </button>
          <div className="mt-4 border-t border-white/10 pt-4 text-[10px] text-[#8192a9]">
            FloodSense Platform <span className="float-right">v1.0 · Demo</span>
          </div>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-[500] flex h-[72px] items-center justify-between border-b border-[#e8edf4] bg-white/95 px-5 backdrop-blur-md md:px-9">
          <div className="flex items-center gap-4">
            <button
              className="text-slate-700 lg:hidden"
              aria-label="Open menu"
              aria-expanded={sidebar}
              aria-controls="primary-navigation"
              onClick={() => setSidebar(true)}
            >
              <Menu size={22} />
            </button>
            <span className="text-xs font-semibold text-[#97a1b1]">
              Platform <span className="px-2 text-slate-300">/</span>
              <span className="text-[#32435c]">{headings[view][0]}</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-slate-500 sm:inline">
              Bengaluru, India
            </span>
            <span className="flex items-center gap-2 rounded-full bg-[#f0f6ff] px-3 py-1.5 text-[10px] font-bold tracking-wider text-blue-700">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />{" "}
              SIMULATED DATA
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e4eafb] text-xs font-bold text-[#3b57a3]">
              FS
            </span>
          </div>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto max-w-[1510px] px-5 pb-10 pt-8 md:px-9 lg:pt-10"
        >
          <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
            <div>
              <div className="label-kicker mb-3 flex items-center gap-2">
                <span className="h-px w-5 bg-blue-600" /> BENGALURU · FLOOD
                MONITORING
              </div>
              <h1 className="text-[30px] font-extrabold text-[#15253a] sm:text-[36px]">
                {headings[view][0]}
                <span className="text-blue-600">.</span>
              </h1>
              <p className="mt-2 text-[13px] text-[#738298]">
                {headings[view][1]}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={downloadCsv} className="btn-secondary">
                <Download size={16} />{" "}
                <span className="hidden sm:inline">Export snapshot</span>
                <span className="sm:hidden">Export</span>
              </button>
              <button
                disabled={loading || !!reportError}
                onClick={() => setModal(true)}
                className="btn-primary"
              >
                <Plus size={16} /> Submit a report
              </button>
            </div>
          </div>
          <div className="mb-7 flex items-start gap-3 rounded-xl border border-[#d9e7f9] bg-[#edf5ff] px-4 py-3 text-[12px] leading-relaxed text-[#3c6289]">
            <Info size={17} className="mt-0.5 shrink-0" />
            <p>
              <b>Interactive prototype.</b> Forecasts, risk scores, route
              estimates and dispatch actions are simulated. Reports are
              unverified observations; sample entries are labelled. This is not
              a live emergency warning service.
            </p>
          </div>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs">
            <p role="status" className="text-slate-600">
              {loading
                ? "Loading reports…"
                : reportError
                  ? "Report storage needs attention."
                  : `${reports.length} reports · ${apiBase ? "Connected report service" : "Browser session · no backend connected"}`}
            </p>
            <div className="flex gap-3">
              <button
                className="font-semibold text-blue-700 disabled:opacity-50"
                disabled={loading}
                onClick={() => void loadReports()}
              >
                Refresh reports
              </button>
              {!apiBase && (
                <button
                  className="font-semibold text-slate-600 disabled:opacity-50"
                  disabled={loading}
                  onClick={async () => {
                    if (
                      !window.confirm(
                        "Reset reports to sample data in this tab? This removes your local contributions.",
                      )
                    )
                      return;
                    try {
                      if (!repository.current)
                        repository.current = createSessionRepository(
                          window.sessionStorage,
                        );
                      const rows = await repository.current.reset!();
                      setReports(rows);
                      setReportError("");
                      setNow(Date.now());
                      notify("Demo reports reset.");
                    } catch {
                      setReportError(
                        "Browser storage is unavailable. Enable storage and retry.",
                      );
                    }
                  }}
                >
                  Reset demo reports
                </button>
              )}
            </div>
          </div>
          {reportError && (
            <p
              role="alert"
              className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
            >
              {reportError}{" "}
              {reports.length
                ? "Previously loaded observations remain visible and may be stale."
                : "Scores currently exclude report contributions."}{" "}
              Use Refresh reports to retry
              {!apiBase
                ? " or Reset demo reports to recover invalid session data"
                : ""}
              .
            </p>
          )}
          <div key={view} className="fade-enter">
            {view === "overview" && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <SectionHeading
                    title="Situation at a glance"
                    sub={`Scenario-based assessment · ${scenario.minute === 0 ? "Now" : `+${scenario.minute} min forecast`}`}
                  />
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
                    <CloudRain size={17} className="text-slate-500" />
                    <select
                      aria-label="Rainfall scenario"
                      className="bg-transparent py-2.5 text-[12px] font-semibold text-slate-700"
                      value={scenario.rainfall}
                      onChange={(e) =>
                        setScenario({
                          ...scenario,
                          rainfall: Number(e.target.value),
                        })
                      }
                    >
                      {scenarioChoices.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={13} />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <Metric
                    icon={TriangleAlert}
                    label="High-risk zones"
                    value={highCount.toString().padStart(2, "0")}
                    foot="Score ≥ 65 / 100"
                    color="red"
                  />
                  <Metric
                    icon={Activity}
                    label="Zones under watch"
                    value={watchCount.toString().padStart(2, "0")}
                    foot="Elevated modeled exposure"
                    color="amber"
                  />
                  <Metric
                    icon={CloudRain}
                    label="Rainfall intensity"
                    value={`${rainfallAt(scenario).toFixed(1)}`}
                    foot="Estimated mm/hr · selected forecast"
                  />
                  <Metric
                    icon={Users}
                    label="Community reports"
                    value={reports.length.toString().padStart(2, "0")}
                    foot="Unverified observations"
                    color="green"
                  />
                </div>
                <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
                  <section className="panel self-start overflow-hidden">
                    <div className="flex items-start justify-between gap-3 p-5 pb-4">
                      <div>
                        <h3 className="font-extrabold">Flood risk map</h3>
                        <p className="mt-1 text-xs text-slate-500">
                          Select a location marker to examine risk
                        </p>
                      </div>
                      <button
                        onClick={() => openView("explorer")}
                        className="flex items-center gap-1 text-xs font-bold text-blue-600"
                      >
                        Expand map <ArrowUpRight size={15} />
                      </button>
                    </div>
                    <RiskMap
                      zones={ZONES}
                      risks={risks}
                      selected={selected}
                      onSelect={setSelected}
                      height="390px"
                    />
                    <div className="p-5">
                      <div className="mb-3 flex justify-between text-xs">
                        <span className="font-bold text-slate-700">
                          Forecast timeline
                        </span>
                        <span className="font-semibold text-blue-600">
                          {scenario.minute === 0
                            ? "Now"
                            : `+${scenario.minute} min`}
                        </span>
                      </div>
                      <input
                        className="w-full"
                        type="range"
                        min="0"
                        max="60"
                        step="5"
                        value={scenario.minute}
                        onChange={(e) =>
                          setScenario({
                            ...scenario,
                            minute: Number(e.target.value),
                          })
                        }
                        aria-label="Minutes ahead"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Now</span>
                        <span>+15 min</span>
                        <span>+30 min</span>
                        <span>+45 min</span>
                        <span>+60 min</span>
                      </div>
                    </div>
                  </section>
                  <div className="space-y-5">
                    <section className="panel panel-pad">
                      <div className="mb-5 flex items-center justify-between">
                        <h3 className="font-extrabold">Location assessment</h3>
                        <SlidersHorizontal
                          className="text-slate-400"
                          size={17}
                        />
                      </div>
                      <ZoneSelect value={selected} onChange={setSelected} />
                      <div className="mt-5 flex items-center gap-5">
                        <div
                          className="relative flex h-[105px] w-[105px] shrink-0 items-center justify-center rounded-full"
                          style={{
                            background: `conic-gradient(${severity(risks[selected]) === "high" ? "#e15b63" : severity(risks[selected]) === "watch" ? "#e1a13c" : "#0f9e83"} ${risks[selected]}%, #edf2f7 0)`,
                          }}
                        >
                          <div className="flex h-[82px] w-[82px] flex-col items-center justify-center rounded-full bg-white">
                            <b className="text-[30px] leading-none">
                              {risks[selected]}
                            </b>
                            <small className="text-[10px] text-slate-400">
                              of 100
                            </small>
                          </div>
                        </div>
                        <div>
                          <RiskBadge value={risks[selected]} />
                          <p className="mt-3 text-sm font-bold text-slate-800">
                            {severity(risks[selected]) === "high"
                              ? "Potential flooding"
                              : severity(risks[selected]) === "watch"
                                ? "Monitor conditions"
                                : "Relatively stable"}
                          </p>
                          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                            Calculated from the selected simulated scenario.
                          </p>
                        </div>
                      </div>
                      <div className="mt-5 space-y-3 border-t border-slate-100 pt-4 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">
                            Ground elevation
                          </span>
                          <b>{getZone(selected).ground}</b>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">
                            Reported drainage blockage
                          </span>
                          <b>
                            {reports.some(
                              (r) => r.zone === selected && r.blocked,
                            )
                              ? "Yes"
                              : "None flagged"}
                          </b>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Area reports</span>
                          <b>
                            {reports.filter((r) => r.zone === selected).length}
                          </b>
                        </div>
                      </div>
                      <RiskExplanation
                        zone={selected}
                        scenario={scenario}
                        reports={reports}
                      />
                    </section>
                    <section className="panel panel-pad">
                      <SectionHeading
                        title="Recent observations"
                        sub="Sample entries and community observations"
                        action={
                          <button
                            onClick={() => openView("reports")}
                            className="text-xs font-bold text-blue-600"
                          >
                            View all <ArrowRight className="inline" size={13} />
                          </button>
                        }
                      />
                      <div className="divide-y divide-slate-100">
                        {reports.slice(0, 3).map((r) => (
                          <div key={r.id} className="flex gap-3 py-3">
                            <div
                              className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${r.cm >= 40 ? "bg-rose-500" : r.cm >= 20 ? "bg-amber-500" : "bg-emerald-500"}`}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold">
                                {getZone(r.zone).name}
                              </p>
                              <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">
                                {r.note}
                              </p>
                            </div>
                            <span className="shrink-0 text-[10px] text-slate-400">
                              {reportAge(r, now)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                </div>
                <section className="panel panel-pad">
                  <SectionHeading
                    title="Monitored locations"
                    sub="Risk rankings update with the forecast scenario"
                    action={
                      <button
                        onClick={() => openView("explorer")}
                        className="text-xs font-bold text-blue-600"
                      >
                        Explore all <ArrowRight size={14} className="inline" />
                      </button>
                    }
                  />
                  <div className="grid gap-3 md:grid-cols-3">
                    {riskList.slice(0, 3).map((z) => (
                      <button
                        key={z.id}
                        onClick={() => {
                          setSelected(z.id);
                          openView("explorer");
                        }}
                        className="rounded-xl border border-slate-200 px-4 py-3 text-left transition hover:border-blue-300 hover:bg-blue-50/30"
                      >
                        <div className="flex justify-between gap-2">
                          <b className="text-xs">{z.name}</b>
                          <ArrowUpRight size={15} className="text-slate-400" />
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <RiskBadge value={z.risk} />
                          <b className="text-lg">
                            {z.risk}
                            <span className="text-xs font-medium text-slate-400">
                              /100
                            </span>
                          </b>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            )}
            {view === "explorer" && (
              <div className="space-y-5">
                <div className="panel overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-3 p-5">
                    <div>
                      <h2 className="font-extrabold">
                        Geospatial risk explorer
                      </h2>
                      <p className="mt-1 text-xs text-slate-500">
                        Map coordinates are approximate locations, not verified
                        flood boundaries.
                      </p>
                    </div>
                    <select
                      aria-label="Rainfall scenario"
                      className="field max-w-[220px]"
                      value={scenario.rainfall}
                      onChange={(e) =>
                        setScenario({
                          ...scenario,
                          rainfall: Number(e.target.value),
                        })
                      }
                    >
                      {scenarioChoices.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <RiskMap
                    zones={ZONES}
                    risks={risks}
                    selected={selected}
                    onSelect={setSelected}
                    height="min(65vh,570px)"
                  />
                  <div className="flex flex-wrap items-center gap-4 p-5">
                    <span className="text-xs font-semibold">
                      Time horizon:{" "}
                      {scenario.minute === 0
                        ? "Now"
                        : `+${scenario.minute} minutes`}
                    </span>
                    <input
                      aria-label="Forecast minutes ahead"
                      className="min-w-[200px] flex-1"
                      type="range"
                      min="0"
                      max="60"
                      step="5"
                      value={scenario.minute}
                      onChange={(e) =>
                        setScenario({
                          ...scenario,
                          minute: Number(e.target.value),
                        })
                      }
                    />
                    <span className="text-xs text-slate-500">
                      Projected risk updates as you move the slider
                    </span>
                  </div>
                </div>
                <section className="panel overflow-hidden">
                  <div className="p-5">
                    <SectionHeading
                      title="Zone risk register"
                      sub="Select any row to focus its marker and risk assessment"
                    />
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          {[
                            "Location",
                            "Risk score",
                            "Risk level",
                            "Community reports",
                            "",
                          ].map((h) => (
                            <th key={h} className="px-5 py-3 font-semibold">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {riskList.map((z) => (
                          <tr
                            key={z.id}
                            onClick={() => setSelected(z.id)}
                            className={`cursor-pointer border-t border-slate-100 transition hover:bg-blue-50 ${selected === z.id ? "bg-blue-50/60" : ""}`}
                          >
                            <td className="px-5 py-4 font-bold">
                              <button
                                aria-pressed={selected === z.id}
                                onClick={() => setSelected(z.id)}
                                className="text-left hover:underline"
                              >
                                {z.name}
                              </button>
                            </td>
                            <td className="px-5 py-4">{z.risk}/100</td>
                            <td className="px-5 py-4">
                              <RiskBadge value={z.risk} />
                            </td>
                            <td className="px-5 py-4">
                              {reports.filter((r) => r.zone === z.id).length}
                            </td>
                            <td className="px-5 py-4 text-blue-600">
                              <ArrowUpRight size={16} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}
            {view === "routes" && (
              <div className="grid gap-5 xl:grid-cols-[.85fr_1.4fr]">
                <div className="space-y-5">
                  <section className="panel panel-pad">
                    <SectionHeading
                      title="Plan a safer journey"
                      sub="Choose locations within the demo road network"
                    />
                    <label className="field-label">Starting location</label>
                    <ZoneSelect
                      value={from}
                      onChange={setFrom}
                      label="Starting location"
                    />
                    <div className="my-3 flex justify-center">
                      <button
                        className="btn-secondary !rounded-full !p-2"
                        onClick={() => {
                          setFrom(to);
                          setTo(from);
                        }}
                        aria-label="Swap locations"
                      >
                        <ArrowDownUp size={16} />
                      </button>
                    </div>
                    <label className="field-label">Destination</label>
                    <ZoneSelect
                      value={to}
                      onChange={setTo}
                      label="Destination"
                    />
                    <div className="mt-5 rounded-xl bg-blue-50 px-4 py-3 text-xs leading-relaxed text-blue-800">
                      <Info size={14} className="mr-2 inline" /> Results compare
                      an illustrative six-zone graph, not actual turn-by-turn
                      driving routes.
                    </div>
                  </section>
                  {from !== to ? (
                    <section className="panel panel-pad">
                      <SectionHeading
                        title="Route comparison"
                        sub="Example estimates, not real travel times"
                      />
                      <p className="mb-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                        {normal.join(",") === safer.join(",")
                          ? "Both models choose the same path in this scenario. No lower-cost alternative was found using the configured risk penalties."
                          : "The flood-aware model trades distance for lower modeled exposure where the graph allows it."}{" "}
                        Connections use distance plus a watch-level penalty of
                        70% of distance, or a high-risk penalty of 500 cost
                        units. Endpoints can still be high risk.
                      </p>
                      {[
                        {
                          name: "Shortest network path",
                          route: normal,
                          color: "slate",
                        },
                        {
                          name: "Flood-aware network path",
                          route: safer,
                          color: "blue",
                        },
                      ].map((item) => (
                        <div
                          key={item.name}
                          className={`mb-3 rounded-xl border p-4 ${item.color === "blue" ? "border-blue-200 bg-blue-50/50" : "border-slate-200"}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <b className="text-xs">{item.name}</b>
                            <b className="text-lg">
                              {routeEstimate(item.route, getRisk)}{" "}
                              <small className="text-[10px] font-medium text-slate-500">
                                min*
                              </small>
                            </b>
                          </div>
                          <p className="mt-2 text-xs leading-5 text-slate-600">
                            {item.route
                              .map((id) => getZone(id).name)
                              .join(" → ")}
                          </p>
                          <p className="mt-2 text-[11px] text-slate-500">
                            Peak modeled exposure: {worst(item.route)}/100 ·{" "}
                            {item.route.filter((id) => risks[id] >= 65).length}{" "}
                            high-risk zones
                          </p>
                        </div>
                      ))}
                      <p className="text-[11px] text-slate-500">
                        *Synthetic relative timing estimates. Do not use for
                        navigation or emergency decisions.
                      </p>
                    </section>
                  ) : (
                    <section className="panel panel-pad text-xs text-slate-500">
                      Select different start and destination locations.
                    </section>
                  )}
                </div>
                <div className="panel self-start overflow-hidden">
                  <div className="p-5">
                    <SectionHeading
                      title="Route visualization"
                      sub="Blue: flood-aware path · dashed gray: shortest network path"
                    />
                  </div>
                  <RiskMap
                    zones={ZONES}
                    risks={risks}
                    route={from !== to ? { usual: normal, safer } : undefined}
                    height="min(70vh,640px)"
                  />
                </div>
              </div>
            )}
            {view === "reports" && (
              <div className="grid gap-5 xl:grid-cols-[1.4fr_.75fr]">
                <section className="panel overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-3 p-5">
                    <SectionHeading
                      title="Community incident feed"
                      sub={
                        apiBase
                          ? "Unverified observations from the report service"
                          : "Sample reports and contributions from this browser tab"
                      }
                    />
                    <button
                      disabled={loading || !!reportError}
                      onClick={() => setModal(true)}
                      className="btn-primary"
                    >
                      <Plus size={15} /> New report
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-3 border-y border-slate-100 bg-slate-50/60 px-5 py-4">
                    <div className="min-w-[170px] flex-1">
                      <ZoneSelect
                        value={filterZone}
                        onChange={setFilterZone}
                        all
                      />
                    </div>
                    <select
                      aria-label="Filter by water depth"
                      className="field max-w-[180px]"
                      value={filterDepth}
                      onChange={(e) => setFilterDepth(e.target.value)}
                    >
                      <option value="all">All depth levels</option>
                      <option value="minor">Under 20 cm</option>
                      <option value="moderate">20–39 cm</option>
                      <option value="severe">40+ cm</option>
                    </select>
                  </div>
                  <div className="divide-y divide-slate-100 px-5">
                    {filtered.length === 0 ? (
                      <div className="py-12 text-center text-sm text-slate-500">
                        No reports match these filters.
                      </div>
                    ) : (
                      filtered.map((r) => (
                        <article key={r.id} className="py-5">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <MapPin size={15} className="text-blue-600" />
                                <h3 className="text-sm font-bold">
                                  {getZone(r.zone).name}
                                </h3>
                              </div>
                              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                                {r.note}
                              </p>
                            </div>
                            <span className="shrink-0 text-[11px] text-slate-400">
                              {reportAge(r, now)}
                            </span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                              {r.cm} cm reported
                            </span>
                            {r.blocked && (
                              <span className="rounded-md bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">
                                Blocked drain
                              </span>
                            )}
                            <span className="rounded-md bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700">
                              {r.source === "sample"
                                ? "Sample observation"
                                : "Community · unverified"}
                            </span>
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </section>
                <aside className="space-y-5">
                  <div className="panel panel-pad">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <Users size={20} />
                    </span>
                    <h3 className="mt-4 font-extrabold">
                      Local knowledge matters.
                    </h3>
                    <p className="mt-2 text-xs leading-6 text-slate-500">
                      Community photos and observations can help people
                      understand changing street-level conditions.{" "}
                      {apiBase
                        ? "Reports are stored by the configured report service."
                        : "Demo entries are stored only in this browser tab."}
                    </p>
                    <button
                      disabled={loading || !!reportError}
                      onClick={() => setModal(true)}
                      className="btn-primary mt-5 w-full"
                    >
                      <Plus size={15} /> Add a demonstration report
                    </button>
                  </div>
                  <div className="panel panel-pad">
                    <SectionHeading title="What to report" />
                    <div className="space-y-3 text-xs text-slate-600">
                      <p>
                        <Check
                          className="mr-2 inline text-emerald-600"
                          size={15}
                        />{" "}
                        Water depth estimate
                      </p>
                      <p>
                        <Check
                          className="mr-2 inline text-emerald-600"
                          size={15}
                        />{" "}
                        Exact neighborhood selection
                      </p>
                      <p>
                        <Check
                          className="mr-2 inline text-emerald-600"
                          size={15}
                        />{" "}
                        Blocked-drain observation
                      </p>
                      <p>
                        <Check
                          className="mr-2 inline text-emerald-600"
                          size={15}
                        />{" "}
                        Optional local image preview
                      </p>
                    </div>
                  </div>
                </aside>
              </div>
            )}
            {view === "operations" && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <SectionHeading
                    title="City operations center"
                    sub="Conceptual risk monitoring and response coordination"
                  />
                  <span className="rounded-full bg-amber-50 px-3 py-1.5 text-[10px] font-bold tracking-wider text-amber-700">
                    DEMO · NO REAL DISPATCH
                  </span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <Metric
                    icon={MapPin}
                    label="Monitored locations"
                    value={ZONES.length}
                    foot="Across sample Bengaluru corridors"
                  />
                  <Metric
                    icon={TriangleAlert}
                    label="Zones needing attention"
                    value={highCount + watchCount}
                    foot="Scores ≥ 35"
                    color="amber"
                  />
                  <Metric
                    icon={ShieldCheck}
                    label="Simulated teams assigned"
                    value={assigned.length}
                    foot="Local UI state only"
                    color="green"
                  />
                  <Metric
                    icon={FileText}
                    label="Incident reports"
                    value={reports.length}
                    foot="Demonstration reports"
                  />
                </div>
                <div className="panel overflow-hidden">
                  <div className="p-5">
                    <SectionHeading
                      title="Operational zone register"
                      sub="Response status is separate from modeled flood exposure"
                    />
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          {[
                            "Zone",
                            "Risk level",
                            "Drain status",
                            "Response status",
                            "Action",
                          ].map((h) => (
                            <th key={h} className="px-5 py-3 font-semibold">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {riskList.map((z) => (
                          <tr key={z.id} className="border-t border-slate-100">
                            <td className="px-5 py-4 font-bold">{z.name}</td>
                            <td className="px-5 py-4">
                              <RiskBadge value={z.risk} />
                            </td>
                            <td className="px-5 py-4">
                              {reports.some((r) => r.zone === z.id && r.blocked)
                                ? "Blockage reported"
                                : "None flagged"}
                            </td>
                            <td className="px-5 py-4">
                              {assigned.includes(z.id)
                                ? "Demo team assigned"
                                : "Unassigned"}
                            </td>
                            <td className="px-5 py-4">
                              <button
                                className="text-xs font-semibold text-blue-600 hover:underline"
                                onClick={() => {
                                  setAssigned((x) =>
                                    x.includes(z.id)
                                      ? x.filter((y) => y !== z.id)
                                      : [...x, z.id],
                                  );
                                  notify(
                                    `Simulation updated for ${z.name}. No actual team was dispatched.`,
                                  );
                                }}
                              >
                                {assigned.includes(z.id)
                                  ? "Recall team"
                                  : "Assign demo team"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="panel panel-pad">
                  <div className="flex items-center justify-between gap-2">
                    <SectionHeading
                      title="Future API response preview"
                      sub="Example JSON contract for later backend integration"
                    />
                    <Database size={19} className="text-slate-500" />
                  </div>
                  <pre className="scroll-thin max-h-[340px] overflow-auto rounded-xl bg-[#132238] p-5 text-[11px] leading-6 text-sky-200">
                    {JSON.stringify(apiExample, null, 2)}
                  </pre>
                  <p className="mt-3 text-xs text-slate-500">
                    Frontend-only example. No endpoint exists or is called in
                    this build.
                  </p>
                </div>
              </div>
            )}
          </div>
          <footer className="mt-10 flex flex-wrap justify-between gap-2 border-t border-slate-200 pt-5 text-[11px] text-slate-400">
            <span>© 2026 FloodSense · Urban flood intelligence concept</span>
            <span>
              SDG 11 · Sustainable Cities &nbsp; / &nbsp; SDG 13 · Climate
              Action
            </span>
          </footer>
        </main>
      </div>
      {modal && (
        <ReportDialog
          mode={apiBase ? "api" : "session"}
          onClose={() => setModal(false)}
          onSubmit={addReport}
        />
      )}
      {toast && (
        <div
          className="fixed bottom-6 right-6 z-[1300] max-w-sm rounded-xl bg-[#172942] px-5 py-3 text-xs font-semibold text-white shadow-xl"
          role="status"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
