import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { FACILITIES, NODES, RIVER, ZONES, responseRoute, roadRisk, toLngLat } from "@/engine/city";
import type { ZoneId } from "@/engine/types";
import { cn } from "@/lib/utils";

// MapLibre paint needs concrete colors; these mirror the design tokens.
const C = {
  bg: "#070A0F",
  road: "#2A3A4C",
  amber: "#F5A623",
  red: "#E5484D",
  teal: "#2DD4BF",
  violet: "#7C5CFF",
  green: "#3DD68C",
};

function geo(exposure: Record<ZoneId, number>, p: number, route: boolean) {
  const safeP = Number.isFinite(p) ? p : 0;
  const risks = roadRisk(exposure, safeP);
  const path = route ? responseRoute(risks) : [];
  const max = Math.max(0.0001, ...Object.values(exposure).map((v) => (Number.isFinite(v) ? v : 0)));
  return {
    zones: {
      type: "FeatureCollection",
      features: ZONES.map((z) => ({
        type: "Feature",
        properties: { id: z.id, risk: ((exposure[z.id] ?? 0) / max) * safeP },
        geometry: {
          type: "Polygon",
          coordinates: [[...z.poly, z.poly[0]!].map((q) => toLngLat(q))],
        },
      })),
    },
    roads: {
      type: "FeatureCollection",
      features: risks.map((r) => ({
        type: "Feature",
        properties: { risk: r.risk },
        geometry: {
          type: "LineString",
          coordinates: [toLngLat(NODES[r.a]!), toLngLat(NODES[r.b]!)],
        },
      })),
    },
    route: {
      type: "FeatureCollection",
      features: path.length
        ? [
            {
              type: "Feature",
              properties: {},
              geometry: { type: "LineString", coordinates: path.map((n) => toLngLat(NODES[n]!)) },
            },
          ]
        : [],
    },
    fac: {
      type: "FeatureCollection",
      features: FACILITIES.map((f) => ({
        type: "Feature",
        properties: { kind: f.kind, atRisk: f.kind !== "depot" && safeP > 0.4 ? 1 : 0 },
        geometry: { type: "Point", coordinates: toLngLat(NODES[f.node]!) },
      })),
    },
  };
}

export function CityMap({
  exposure,
  pCrisis,
  showRoute,
  focus = "riverside",
  degraded = false,
  className,
}: {
  exposure: Record<ZoneId, number>;
  pCrisis: number;
  showRoute: boolean;
  focus?: ZoneId;
  degraded?: boolean;
  className?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<import("maplibre-gl").Map | null>(null);
  const ready = useRef(false);
  const baseZoom = useRef(12.6);

  const roundedPCrisis = Number.isFinite(pCrisis) ? Math.round(pCrisis * 100) / 100 : 0;
  const latest = useRef({ exposure, pCrisis: roundedPCrisis, showRoute, focus });
  latest.current = { exposure, pCrisis: roundedPCrisis, showRoute, focus };

  const lastUpdateT = useRef(0);
  const lastStateKey = useRef("");

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    let ro: ResizeObserver | undefined;
    import("maplibre-gl").then((mod) => {
      const maplibregl = (mod as unknown as { default?: typeof mod }).default ?? mod;
      if (cancelled || !el.current) return;
      const m = new maplibregl.Map({
        container: el.current,
        style: {
          version: 8,
          sources: {},
          layers: [{ id: "bg", type: "background", paint: { "background-color": C.bg } }],
        },
        center: toLngLat([50, 50]),
        zoom: 12.6,
        pitch: 35,
        interactive: false,
        attributionControl: false,
      });
      map.current = m;
      ro = new ResizeObserver(() => m.resize());
      ro.observe(el.current);
      m.on("load", () => {
        const g = geo(latest.current.exposure, latest.current.pCrisis, latest.current.showRoute);
        const river = {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: RIVER.map((q) => toLngLat(q)) },
        };
        m.addSource("zones", { type: "geojson", data: g.zones as never });
        m.addSource("roads", { type: "geojson", data: g.roads as never });
        m.addSource("route", { type: "geojson", data: g.route as never });
        m.addSource("fac", { type: "geojson", data: g.fac as never });
        m.addSource("river", { type: "geojson", data: river as never });
        m.addLayer({
          id: "zones",
          type: "fill",
          source: "zones",
          paint: { "fill-color": C.red, "fill-opacity": ["*", ["get", "risk"], 0.3] },
        });
        m.addLayer({
          id: "zone-lines",
          type: "line",
          source: "zones",
          paint: { "line-color": "#ffffff", "line-opacity": 0.06 },
        });
        m.addLayer({
          id: "river",
          type: "line",
          source: "river",
          paint: { "line-color": C.teal, "line-opacity": 0.35, "line-width": 10, "line-blur": 3 },
        });
        m.addLayer({
          id: "roads",
          type: "line",
          source: "roads",
          paint: {
            "line-color": [
              "interpolate",
              ["linear"],
              ["get", "risk"],
              0,
              C.road,
              0.2,
              C.amber,
              0.55,
              C.red,
            ],
            "line-width": ["interpolate", ["linear"], ["get", "risk"], 0, 1.5, 1, 4],
          },
        });
        m.addLayer({
          id: "route-glow",
          type: "line",
          source: "route",
          paint: { "line-color": C.green, "line-width": 10, "line-opacity": 0.25, "line-blur": 4 },
        });
        m.addLayer({
          id: "route",
          type: "line",
          source: "route",
          paint: { "line-color": C.green, "line-width": 3, "line-dasharray": [2, 1] },
        });
        m.addLayer({
          id: "fac-halo",
          type: "circle",
          source: "fac",
          paint: { "circle-radius": 14, "circle-opacity": 0, "circle-color": C.red },
        });
        m.addLayer({
          id: "fac",
          type: "circle",
          source: "fac",
          paint: {
            "circle-radius": 6,
            "circle-color": [
              "match",
              ["get", "kind"],
              "hospital",
              C.red,
              "shelter",
              C.violet,
              C.green,
            ],
            "circle-stroke-color": C.bg,
            "circle-stroke-width": 2,
          },
        });
        m.fitBounds([toLngLat([-4, 104]), toLngLat([104, -4])], {
          padding: 24,
          duration: 0,
          pitch: 35,
        });
        baseZoom.current = m.getZoom();
        ready.current = true;
        const loop = (t: number) => {
          const k = (t % 1600) / 1600;
          m.setPaintProperty("fac-halo", "circle-radius", 6 + k * 18);
          m.setPaintProperty("fac-halo", "circle-opacity", ["*", ["get", "atRisk"], 0.5 * (1 - k)]);
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      map.current?.remove();
      map.current = null;
      ready.current = false;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m || !ready.current) return;

    const now = Date.now();
    const currentKey = `${roundedPCrisis}_${showRoute}_${JSON.stringify(exposure)}`;
    if (currentKey === lastStateKey.current) return;

    if (now - lastUpdateT.current < 250) {
      const timer = setTimeout(
        () => {
          if (!map.current || !ready.current) return;
          const g = geo(exposure, roundedPCrisis, showRoute);
          (map.current.getSource("zones") as import("maplibre-gl").GeoJSONSource)?.setData(
            g.zones as never,
          );
          (map.current.getSource("roads") as import("maplibre-gl").GeoJSONSource)?.setData(
            g.roads as never,
          );
          (map.current.getSource("route") as import("maplibre-gl").GeoJSONSource)?.setData(
            g.route as never,
          );
          (map.current.getSource("fac") as import("maplibre-gl").GeoJSONSource)?.setData(
            g.fac as never,
          );
          lastStateKey.current = currentKey;
          lastUpdateT.current = Date.now();
        },
        250 - (now - lastUpdateT.current),
      );
      return () => clearTimeout(timer);
    }

    lastUpdateT.current = now;
    lastStateKey.current = currentKey;
    const g = geo(exposure, roundedPCrisis, showRoute);
    (m.getSource("zones") as import("maplibre-gl").GeoJSONSource)?.setData(g.zones as never);
    (m.getSource("roads") as import("maplibre-gl").GeoJSONSource)?.setData(g.roads as never);
    (m.getSource("route") as import("maplibre-gl").GeoJSONSource)?.setData(g.route as never);
    (m.getSource("fac") as import("maplibre-gl").GeoJSONSource)?.setData(g.fac as never);
    return undefined;
  }, [exposure, roundedPCrisis, showRoute]);

  useEffect(() => {
    const m = map.current;
    if (!m || !ready.current) return;
    const z = ZONES.find((x) => x.id === focus)!;
    const cx = (z.poly[0]![0] + z.poly[2]![0]) / 2;
    const cy = (z.poly[0]![1] + z.poly[2]![1]) / 2;
    const target =
      roundedPCrisis > 0.6 ? toLngLat([(cx + 50) / 2, (cy + 50) / 2]) : toLngLat([50, 50]);
    m.easeTo({
      center: target,
      zoom: baseZoom.current + (roundedPCrisis > 0.6 ? 0.4 : 0),
      duration: 1800,
    });
  }, [focus, roundedPCrisis > 0.6]);

  return (
    <div
      className={cn(
        "relative h-full min-h-[320px] w-full overflow-hidden rounded-xl border border-border",
        className,
      )}
    >
      <div ref={el} style={{ position: "absolute", inset: 0 }} />
      <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-background/70 px-3 py-1 font-mono text-[10px] tracking-widest">
        <span className="relative flex h-2 w-2">
          <span className="pulse-ring absolute inset-0 rounded-full bg-signal" />
          <span className="relative h-2 w-2 rounded-full bg-signal" />
        </span>
        LIVE BELIEFS
      </div>
      {degraded && (
        <div className="absolute inset-0 grid place-items-center bg-background/40 font-mono text-xs tracking-[0.3em] text-amber">
          DEGRADED · LAST KNOWN BELIEF
        </div>
      )}
      <div className="absolute bottom-3 left-3 space-y-1 rounded-md bg-background/70 p-2 font-mono text-[10px] text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="h-0.5 w-4 bg-amber" />
          at risk
        </div>
        <div className="flex items-center gap-2">
          <span className="h-0.5 w-4 bg-signal" />
          closed
        </div>
        <div className="flex items-center gap-2">
          <span className="h-0.5 w-4 bg-safe" />
          response route
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-signal" />
          hospital <span className="h-2 w-2 rounded-full bg-violet" />
          shelter
        </div>
      </div>
    </div>
  );
}
