"use client";
import { useEffect, useRef, useState } from "react";
import type { Zone } from "../lib/demo";
import { severity } from "../lib/demo";
import {
  BBMP_LAYERS,
  bbmpPopupHtml,
  loadBbmpLayer,
  type BbmpLayerId,
  type BbmpPoint,
} from "../lib/bbmp";
type Props = {
  zones: Zone[];
  risks: Record<string, number>;
  selected?: string;
  onSelect?: (id: string) => void;
  route?: { usual: string[]; safer: string[] };
  height?: string;
  /** Whether the official BBMP overlay layers start switched on. */
  bbmpDefaultVisible?: boolean;
};
export default function RiskMap({
  zones,
  risks,
  selected,
  onSelect,
  route,
  height = "410px",
  bbmpDefaultVisible = true,
}: Props) {
  const [mapReady, setMapReady] = useState(false),
    [mapError, setMapError] = useState(""),
    [attempt, setAttempt] = useState(0);
  const [visible, setVisible] = useState<Record<BbmpLayerId, boolean>>(() => ({
      "flood-prone": bbmpDefaultVisible,
      "low-lying": bbmpDefaultVisible,
      "flood-vulnerable": bbmpDefaultVisible,
    })),
    [bbmpData, setBbmpData] = useState<
      Partial<Record<BbmpLayerId, BbmpPoint[]>>
    >({}),
    [bbmpError, setBbmpError] = useState(""),
    [bbmpAttempt, setBbmpAttempt] = useState(0),
    [panelOpen, setPanelOpen] = useState(
      () =>
        typeof window === "undefined" ||
        window.matchMedia("(min-width: 640px)").matches,
    );
  const container = useRef<HTMLDivElement>(null),
    mapRef = useRef<import("leaflet").Map | null>(null),
    layers = useRef<import("leaflet").Layer[]>([]),
    overlays = useRef<import("leaflet").Layer[]>([]),
    renderer = useRef<import("leaflet").Renderer | null>(null),
    cb = useRef(onSelect);
  cb.current = onSelect;
  useEffect(() => {
    let disposed = false;
    let map: import("leaflet").Map | null = null;
    let resize: ResizeObserver | undefined;
    setMapReady(false);
    setMapError("");
    (async () => {
      try {
        const L = await import("leaflet");
        if (disposed || !container.current || mapRef.current) return;
        map = L.map(container.current, {
          scrollWheelZoom: false,
          zoomControl: false,
          attributionControl: true,
        }).setView([12.972, 77.615], 11);
        mapRef.current = map;
        renderer.current = L.canvas({ padding: 0.5 });
        setMapReady(true);
        L.control.zoom({ position: "bottomright" }).addTo(map);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
          maxZoom: 19,
        })
          .on("tileerror", () => {
            if (!disposed)
              setMapError(
                "Some background map tiles could not load. Zone data remains available below.",
              );
          })
          .addTo(map);
        resize = new ResizeObserver(() => map?.invalidateSize());
        resize.observe(container.current);
      } catch {
        if (!disposed)
          setMapError(
            "The interactive map could not load. Use the zone list below.",
          );
      }
    })();
    return () => {
      disposed = true;
      resize?.disconnect();
      map?.remove();
      mapRef.current = null;
      renderer.current = null;
      layers.current = [];
      overlays.current = [];
    };
  }, [attempt]);
  useEffect(() => {
    let cancelled = false;
    setBbmpError("");
    Promise.allSettled(BBMP_LAYERS.map((l) => loadBbmpLayer(l.id))).then(
      (results) => {
        if (cancelled) return;
        const next: Partial<Record<BbmpLayerId, BbmpPoint[]>> = {};
        const failed: string[] = [];
        results.forEach((r, i) => {
          if (r.status === "fulfilled") next[BBMP_LAYERS[i].id] = r.value;
          else failed.push(BBMP_LAYERS[i].label);
        });
        setBbmpData(next);
        if (failed.length)
          setBbmpError(`Could not load: ${failed.join(", ")}.`);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [bbmpAttempt]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !mapRef.current) return;
      const m = mapRef.current;
      overlays.current.forEach((l) => m.removeLayer(l));
      overlays.current = [];
      for (const layer of BBMP_LAYERS) {
        const points = bbmpData[layer.id];
        if (!visible[layer.id] || !points) continue;
        const group = L.layerGroup();
        for (const p of points)
          L.circleMarker([p.lat, p.lng], {
            renderer: renderer.current ?? undefined,
            radius: 5.5,
            color: "#ffffff",
            weight: 1.5,
            fillColor: layer.color,
            fillOpacity: 0.85,
          })
            .bindTooltip(p.name, { direction: "top", offset: [0, -6] })
            .bindPopup(bbmpPopupHtml(layer, p))
            .addTo(group);
        group.addTo(m);
        overlays.current.push(group);
      }
    })().catch(() => {
      if (!cancelled) setBbmpError("BBMP layers could not be drawn.");
    });
    return () => {
      cancelled = true;
    };
  }, [bbmpData, visible, mapReady]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !mapRef.current) return;
      const m = mapRef.current;
      layers.current.forEach((l) => m.removeLayer(l));
      layers.current = [];
      const colors = { low: "#0e9f82", watch: "#dda043", high: "#de5761" };
      zones.forEach((z) => {
        const n = risks[z.id] ?? 0,
          c = colors[severity(n)],
          active = selected === z.id;
        const html = `<div style="display:grid;place-items:center;width:${active ? 48 : 40}px;height:${active ? 48 : 40}px;border-radius:50%;background:${c};border:3px solid #fff;color:white;font:700 13px Arial;box-shadow:0 3px 14px #091e3540;${active ? "outline:3px solid #1e4ed8;outline-offset:2px;" : ""}">${n}</div>`;
        const marker = L.marker([z.lat, z.lng], {
          icon: L.divIcon({
            html,
            className: "",
            iconSize: [active ? 48 : 40, active ? 48 : 40],
            iconAnchor: [active ? 24 : 20, active ? 24 : 20],
          }),
        })
          .addTo(m)
          .bindTooltip(`${z.name} · ${n}/100`, {
            direction: "top",
            offset: [0, -22],
          });
        marker.on("click", () => cb.current?.(z.id));
        layers.current.push(marker);
      });
      if (route) {
        const coordinates = (ids: string[]) =>
          ids
            .map((id) => zones.find((z) => z.id === id))
            .filter((z): z is Zone => Boolean(z))
            .map((z) => [z.lat, z.lng] as [number, number]);
        const a = coordinates(route.usual),
          b = coordinates(route.safer);
        if (a.length) {
          const line = L.polyline(a, {
            color: "#8999ac",
            weight: 7,
            dashArray: "7 10",
            opacity: 0.8,
          }).addTo(m);
          layers.current.push(line);
        }
        if (b.length) {
          const line = L.polyline(b, {
            color: "#2563eb",
            weight: 5,
            opacity: 0.95,
          }).addTo(m);
          layers.current.push(line);
          m.fitBounds(L.latLngBounds([...a, ...b]).pad(0.25), {
            animate: false,
          });
        }
      }
    })().catch(() => {
      if (!cancelled)
        setMapError("Map layers could not update. Use the zone list below.");
    });
    return () => {
      cancelled = true;
    };
  }, [zones, risks, selected, route, mapReady]);
  return (
    <div>
      <div
        className="relative w-full overflow-hidden bg-[#e5edf1]"
        style={{ height }}
      >
        <div
          ref={container}
          className="h-full w-full"
          aria-label="Interactive map of demonstration flood risk and official BBMP flood locations around Bengaluru"
          role="region"
        />
        {!mapReady && !mapError && (
          <p
            role="status"
            className="absolute inset-0 grid place-items-center text-sm text-slate-600"
          >
            Loading map…
          </p>
        )}
        <div className="pointer-events-none absolute left-4 top-4 z-[400] rounded-lg border border-white/90 bg-white/95 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-600 shadow-sm">
          Illustrative flood risk · not live
        </div>
        <details
          open={panelOpen}
          onToggle={(e) => setPanelOpen(e.currentTarget.open)}
          className="absolute right-3 top-14 z-[450] w-52 rounded-lg sm:top-3 sm:w-56 border border-white/90 bg-white/95 text-xs text-slate-700 shadow-sm"
        >
          <summary className="cursor-pointer select-none px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
            BBMP flood data
          </summary>
          <fieldset className="space-y-1.5 px-3 pb-3">
            <legend className="sr-only">Toggle BBMP map layers</legend>
            {BBMP_LAYERS.map((l) => {
              const count = bbmpData[l.id]?.length;
              return (
                <label
                  key={l.id}
                  className="flex cursor-pointer items-center gap-2"
                  title={l.description}
                >
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-blue-600"
                    checked={visible[l.id]}
                    onChange={(e) =>
                      setVisible((v) => ({ ...v, [l.id]: e.target.checked }))
                    }
                  />
                  <i
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-white"
                    style={{ background: l.color }}
                  />
                  <span className="flex-1">{l.label}</span>
                  <span className="tabular-nums text-slate-500">
                    {count ?? "…"}
                  </span>
                </label>
              );
            })}
            {bbmpError && (
              <p role="status" className="pt-1 text-[11px] text-amber-800">
                {bbmpError}{" "}
                <button
                  type="button"
                  className="font-bold underline"
                  onClick={() => setBbmpAttempt((n) => n + 1)}
                >
                  Retry
                </button>
              </p>
            )}
            <p className="pt-1 text-[10px] leading-snug text-slate-500">
              Source: BBMP open data. Click a point for details.
            </p>
          </fieldset>
        </details>
        <div className="pointer-events-none absolute bottom-5 left-4 z-[400] flex gap-3 rounded-lg bg-white/95 px-3 py-2 text-xs text-slate-600 shadow-sm">
          <span>
            <i className="legend-dot bg-emerald-500" /> Low
          </span>
          <span>
            <i className="legend-dot bg-amber-500" /> Watch
          </span>
          <span>
            <i className="legend-dot bg-rose-500" /> High
          </span>
        </div>
      </div>
      {mapError && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 bg-amber-50 p-3 text-xs text-amber-900"
        >
          <p>{mapError}</p>
          <button
            className="shrink-0 font-bold underline"
            onClick={() => setAttempt((n) => n + 1)}
          >
            Retry map
          </button>
        </div>
      )}
      <div
        role="group"
        aria-label="Map locations"
        className="flex flex-wrap gap-2 border-t border-slate-100 bg-white p-3"
      >
        {zones.map((z) =>
          onSelect ? (
            <button
              key={z.id}
              aria-pressed={selected === z.id}
              onClick={() => onSelect(z.id)}
              className={`rounded-lg border px-2.5 py-1.5 text-[11px] transition-colors ${selected === z.id ? "border-blue-300 bg-blue-50 text-blue-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
            >
              {z.name} · {risks[z.id] ?? 0}/100
            </button>
          ) : (
            <span key={z.id} className="text-[11px] text-slate-600">
              {z.name} · {risks[z.id] ?? 0}/100
            </span>
          ),
        )}
      </div>
    </div>
  );
}
