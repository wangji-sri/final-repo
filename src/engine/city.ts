/**
 * Synthetic city "Harrow Bay" — a grid in local coordinates (0..100), projected
 * to lon/lat for MapLibre. Roads are graph edges; the response route is
 * a Dijkstra shortest path that avoids closed segments.
 */
import type { ZoneId } from "./types";

export const ORIGIN = { lon: 4.88, lat: 52.36 };
const SCALE = 0.0009; // degrees per local unit
export const toLngLat = ([x, y]: [number, number]): [number, number] => [
  ORIGIN.lon + x * SCALE,
  ORIGIN.lat - y * SCALE * 0.62,
];

export const ZONES: { id: ZoneId; name: string; poly: [number, number][] }[] = [
  {
    id: "riverside",
    name: "Riverside",
    poly: [
      [0, 50],
      [50, 50],
      [50, 100],
      [0, 100],
    ],
  },
  {
    id: "old_town",
    name: "Old Town",
    poly: [
      [50, 50],
      [100, 50],
      [100, 100],
      [50, 100],
    ],
  },
  {
    id: "harbor",
    name: "Harbor",
    poly: [
      [50, 0],
      [100, 0],
      [100, 50],
      [50, 50],
    ],
  },
  {
    id: "uplands",
    name: "Uplands",
    poly: [
      [0, 0],
      [50, 0],
      [50, 50],
      [0, 50],
    ],
  },
];
export const zoneAt = (x: number, y: number): ZoneId =>
  y >= 50 ? (x < 50 ? "riverside" : "old_town") : x < 50 ? "uplands" : "harbor";

export const RIVER: [number, number][] = [
  [0, 82],
  [18, 78],
  [34, 86],
  [52, 80],
  [70, 88],
  [100, 84],
];

const STEP = 12.5;
export const NODES: [number, number][] = [];
for (let j = 0; j <= 8; j++) for (let i = 0; i <= 8; i++) NODES.push([i * STEP, j * STEP]);
const nid = (i: number, j: number) => j * 9 + i;

export interface Road {
  id: string;
  a: number;
  b: number;
  zone: ZoneId;
  low: number;
}
export const ROADS: Road[] = [];
for (let j = 0; j <= 8; j++)
  for (let i = 0; i <= 8; i++) {
    const add = (a: number, b: number) => {
      const [x1, y1] = NODES[a]!;
      const [x2, y2] = NODES[b]!;
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      ROADS.push({
        id: `r${a}-${b}`,
        a,
        b,
        zone: zoneAt(mx, my),
        low: my >= 75 ? 1 : my >= 62 ? 0.6 : 0.2,
      });
    };
    if (i < 8) add(nid(i, j), nid(i + 1, j));
    if (j < 8) add(nid(i, j), nid(i, j + 1));
  }

export const FACILITIES = [
  { id: "hospital-st-aldric", name: "St. Aldric Hospital", kind: "hospital", node: nid(6, 5) },
  { id: "hospital-riverside", name: "Riverside General", kind: "hospital", node: nid(2, 6) },
  { id: "shelter-north", name: "North Shelter", kind: "shelter", node: nid(3, 1) },
  { id: "depot", name: "Response Depot", kind: "depot", node: nid(1, 2) },
] as const;

/** Exposure of each road in [0,1], from zone exposure and how low-lying it is. */
export function roadRisk(exposure: Record<ZoneId, number>, pCrisis: number) {
  const max = Math.max(0.0001, ...Object.values(exposure));
  return ROADS.map((r) => {
    const z = exposure[r.zone] / max;
    const base = z * z * pCrisis * r.low * 0.85;
    return { ...r, risk: Math.min(1, base) };
  });
}

/** Dijkstra from depot to target hospital; closed roads (risk > 0.55) are impassable, risky ones cost more. */
export function responseRoute(
  risks: ReturnType<typeof roadRisk>,
  target = "hospital-st-aldric",
): number[] {
  const from = FACILITIES.find((f) => f.id === "depot")!.node;
  const to = FACILITIES.find((f) => f.id === target)!.node;
  const adj = new Map<number, { n: number; w: number }[]>();
  for (const r of risks) {
    if (r.risk > 0.55) continue;
    const w = 1 + r.risk * 6;
    adj.set(r.a, [...(adj.get(r.a) ?? []), { n: r.b, w }]);
    adj.set(r.b, [...(adj.get(r.b) ?? []), { n: r.a, w }]);
  }
  const dist = new Map<number, number>([[from, 0]]);
  const prev = new Map<number, number>();
  const open = new Set<number>([from]);
  while (open.size) {
    let u = -1;
    for (const n of open) if (u < 0 || dist.get(n)! < dist.get(u)!) u = n;
    open.delete(u);
    if (u === to) break;
    for (const { n, w } of adj.get(u) ?? []) {
      const d = dist.get(u)! + w;
      if (d < (dist.get(n) ?? Infinity)) {
        dist.set(n, d);
        prev.set(n, u);
        open.add(n);
      }
    }
  }
  if (!dist.has(to)) return [];
  const path = [to];
  while (path[0] !== from) path.unshift(prev.get(path[0]!)!);
  return path;
}
