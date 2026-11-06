import { INITIAL_REPORTS, ZONES, type Report } from "./demo";

export type ReportInput = Pick<Report, "zone" | "cm" | "blocked" | "note">;
export interface ReportRepository {
  mode: "session" | "api";
  list(signal?: AbortSignal): Promise<Report[]>;
  create(input: ReportInput): Promise<Report>;
  reset?(): Promise<Report[]>;
}
const storageKey = "floodsense-next-reports";
export function validateReport(input: ReportInput): ReportInput {
  if (!ZONES.some((z) => z.id === input.zone))
    throw new Error("Select a valid location.");
  if (!Number.isFinite(input.cm) || input.cm < 0 || input.cm > 200)
    throw new Error("Water depth must be between 0 and 200 cm.");
  if (
    typeof input.blocked !== "boolean" ||
    typeof input.note !== "string" ||
    input.note.trim().length > 400
  )
    throw new Error("Check the observation fields (maximum 400 characters).");
  return {
    ...input,
    note: input.note.trim() || "Waterlogging observed near this location.",
  };
}
export function parseReports(value: unknown): Report[] {
  if (!Array.isArray(value)) throw new Error("The report data is not a list.");
  return value.map((item) => {
    if (
      !item ||
      typeof item !== "object" ||
      typeof item.id !== "string" ||
      !item.id ||
      typeof item.timestamp !== "number" ||
      !Number.isFinite(item.timestamp) ||
      item.timestamp < 0
    )
      throw new Error("A report has invalid fields.");
    const input = validateReport(item as ReportInput);
    return {
      ...input,
      id: item.id,
      timestamp: item.timestamp,
      minutes: null,
      source: item.source === "sample" ? "sample" : "community",
    };
  });
}
export function sampleReports(now = Date.now()): Report[] {
  return INITIAL_REPORTS.map((r) => ({
    ...r,
    timestamp: now - (r.minutes ?? 0) * 60000,
    source: "sample",
  }));
}
export function reportAge(report: Report, now: number) {
  const minutes =
    report.timestamp === undefined
      ? (report.minutes ?? 0)
      : Math.max(0, Math.floor((now - report.timestamp) / 60000));
  return minutes < 1
    ? "Just now"
    : minutes < 60
      ? `${minutes} min ago`
      : minutes < 1440
        ? `${Math.floor(minutes / 60)} hr ago`
        : `${Math.floor(minutes / 1440)} days ago`;
}
export function createSessionRepository(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
): ReportRepository {
  const save = (reports: Report[]) => {
    storage.setItem(storageKey, JSON.stringify(reports));
    return reports;
  };
  const list = async () => {
    const raw = storage.getItem(storageKey);
    if (!raw) return save(sampleReports());
    // Upgrade the original prototype's session records once; never silently replace invalid data.
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value))
      throw new Error(
        "Stored reports are invalid. Reset the demo session to recover.",
      );
    const now = Date.now();
    const upgraded = value.map((r) => ({
      ...r,
      timestamp: r.timestamp ?? now - (r.minutes ?? 0) * 60000,
      source:
        r.source ??
        (INITIAL_REPORTS.some((s) => s.id === r.id) ? "sample" : "community"),
    }));
    return save(parseReports(upgraded));
  };
  return {
    mode: "session",
    list,
    async create(input) {
      const clean = validateReport(input);
      const reports = await list();
      const report: Report = {
        ...clean,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        minutes: null,
        source: "community",
      };
      save([report, ...reports]);
      return report;
    },
    async reset() {
      return save(sampleReports());
    },
  };
}
export function createApiRepository(
  base: string,
  request: typeof fetch = fetch,
): ReportRepository {
  async function call(path: string, init: RequestInit = {}) {
    const timeout = AbortSignal.timeout(12000);
    const signal = init.signal
      ? AbortSignal.any([init.signal, timeout])
      : timeout;
    const response = await request(`${base.replace(/\/$/, "")}${path}`, {
      ...init,
      credentials: "include",
      signal,
      headers: { "Content-Type": "application/json", ...init.headers },
    });
    if (!response.ok)
      throw new Error(
        response.status === 401
          ? "Sign in to submit a report."
          : `Report service unavailable (${response.status}). Please retry.`,
      );
    return response.json();
  }
  return {
    mode: "api",
    async list(signal) {
      return parseReports(await call("/reports", { signal }));
    },
    async create(input) {
      const clean = validateReport(input);
      return parseReports([
        await call("/reports", { method: "POST", body: JSON.stringify(clean) }),
      ])[0];
    },
  };
}
