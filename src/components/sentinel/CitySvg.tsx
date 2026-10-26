import { motion } from "framer-motion";
import { useMemo } from "react";
import { FACILITIES, NODES, RIVER, ROADS, ZONES, responseRoute, roadRisk } from "@/engine/city";
import type { ZoneId } from "@/engine/types";

const riskColor = (r: number) =>
  r > 0.55
    ? "var(--signal)"
    : r > 0.2
      ? "var(--amber)"
      : "color-mix(in oklab, var(--foreground) 16%, transparent)";

/** Lightweight SVG rendering of the synthetic city, driven by engine beliefs. */
export function CitySvg({
  exposure,
  pCrisis,
  showRoute,
  className,
}: {
  exposure: Record<ZoneId, number>;
  pCrisis: number;
  showRoute: boolean;
  className?: string;
}) {
  const risks = useMemo(() => roadRisk(exposure, pCrisis), [exposure, pCrisis]);
  const route = useMemo(() => (showRoute ? responseRoute(risks) : []), [risks, showRoute]);
  const routeD = route.map((n, i) => `${i ? "L" : "M"}${NODES[n]![0]},${NODES[n]![1]}`).join(" ");
  return (
    <svg
      viewBox="-4 -4 108 108"
      className={className}
      role="img"
      aria-label="Synthetic city map with risk overlay"
    >
      {ZONES.map((z) => (
        <polygon
          key={z.id}
          points={z.poly.map((p) => p.join(",")).join(" ")}
          fill="var(--signal)"
          opacity={Math.round(Math.min(0.28, (exposure[z.id] ?? 0) * pCrisis * 0.4) * 1000) / 1000}
          style={{ transition: "opacity .6s" }}
        />
      ))}
      <path
        d={`M${RIVER.map((p) => p.join(",")).join(" L")}`}
        stroke="var(--teal)"
        strokeOpacity={0.35}
        strokeWidth={3}
        fill="none"
      />
      {risks.map((r) => {
        const [x1, y1] = NODES[r.a]!;
        const [x2, y2] = NODES[r.b]!;
        return (
          <line
            key={r.id}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={riskColor(r.risk)}
            strokeWidth={r.risk > 0.2 ? 0.9 : 0.4}
            style={{ transition: "stroke .6s" }}
          />
        );
      })}
      {routeD && (
        <motion.path
          key={routeD}
          d={routeD}
          stroke="var(--safe)"
          strokeWidth={1.4}
          fill="none"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.4 }}
        />
      )}
      {FACILITIES.map((f) => {
        const [x, y] = NODES[f.node]!;
        const color =
          f.kind === "hospital"
            ? "var(--signal)"
            : f.kind === "shelter"
              ? "var(--violet)"
              : "var(--safe)";
        return (
          <g key={f.id}>
            {f.kind !== "depot" && pCrisis > 0.4 && (
              <circle
                cx={x}
                cy={y}
                r={2}
                fill={color}
                className="pulse-ring"
                style={{ transformOrigin: `${x}px ${y}px`, transformBox: "fill-box" }}
              />
            )}
            <circle cx={x} cy={y} r={1.6} fill={color} />
          </g>
        );
      })}
      {ZONES.map((z) => (
        <text
          key={z.id}
          x={z.poly[0]![0] + 2}
          y={z.poly[0]![1] + 5}
          fontSize={3}
          fill="var(--muted-foreground)"
          fontFamily="JetBrains Mono"
        >
          {z.name.toUpperCase()}
        </text>
      ))}
    </svg>
  );
}
