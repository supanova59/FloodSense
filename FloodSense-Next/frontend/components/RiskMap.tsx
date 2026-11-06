"use client";
import { useEffect, useRef, useState } from "react";
import type { Zone } from "../lib/demo";
import { severity } from "../lib/demo";
type Props = {
  zones: Zone[];
  risks: Record<string, number>;
  selected?: string;
  onSelect?: (id: string) => void;
  route?: { usual: string[]; safer: string[] };
  height?: string;
};
export default function RiskMap({
  zones,
  risks,
  selected,
  onSelect,
  route,
  height = "410px",
}: Props) {
  const [mapReady, setMapReady] = useState(false),
    [mapError, setMapError] = useState(""),
    [attempt, setAttempt] = useState(0);
  const container = useRef<HTMLDivElement>(null),
    mapRef = useRef<import("leaflet").Map | null>(null),
    layers = useRef<import("leaflet").Layer[]>([]),
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
        }).setView([12.981, 77.675], 11);
        mapRef.current = map;
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
      layers.current = [];
    };
  }, [attempt]);
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
          aria-label="Interactive map of demonstration flood risk around Bengaluru"
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
