import {
  getZone,
  riskBreakdown,
  type Report,
  type Scenario,
} from "../lib/demo";

export default function RiskExplanation({
  zone,
  scenario,
  reports,
}: {
  zone: string;
  scenario: Scenario;
  reports: Report[];
}) {
  const result = riskBreakdown(getZone(zone), scenario, reports);
  return (
    <details
      className="risk-explanation mt-5 rounded-xl border border-slate-200 bg-slate-50/60 p-4"
      open
    >
      <summary className="cursor-pointer text-xs font-bold text-slate-700">
        Why this score?
      </summary>
      <div className="mt-4 space-y-3">
        {result.factors.map((f) => (
          <div key={f.label}>
            <div className="mb-1 flex justify-between gap-3 text-[11px]">
              <span className="text-slate-600">{f.label}</span>
              <span className="font-semibold tabular-nums">
                +{f.value.toFixed(1)}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div
                className="risk-factor h-full rounded-full bg-blue-500"
                style={{ width: `${Math.min(100, f.value)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[11px] leading-5 text-slate-600">
        Raw total {result.raw.toFixed(1)} → rounded and capped at 100:{" "}
        <b>{result.total}</b>. Low &lt;35 · Watch 35–64 · High ≥65.
      </p>
      <p className="mt-2 text-[11px] leading-5 text-slate-500">
        Illustrative weights and sample location assumptions. This index is not
        a probability or a validated flood forecast. Team assignment does not
        change physical exposure.
      </p>
    </details>
  );
}
