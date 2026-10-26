/** Layer 3b — foresight over the city's causal chain. */
import type { IngestedEvent, PredictedEvent, Source, ZoneId } from "./types";
import { WINDOW_S, TYPE_WEIGHT } from "./rules";

type Node = PredictedEvent["event_type"];

/** Edges with lag distribution [min, max] in virtual seconds. */
export const CAUSAL_EDGES: { from: Node; to: Node; lag: [number, number] }[] = [
  { from: "heavy_rain", to: "drainage_anomaly", lag: [60, 240] },
  { from: "drainage_anomaly", to: "traffic_slowdown", lag: [60, 180] },
  { from: "traffic_slowdown", to: "emergency_call_spike", lag: [90, 240] },
  { from: "emergency_call_spike", to: "hospital_surge", lag: [120, 360] },
  { from: "hospital_surge", to: "shelter_access_degraded", lag: [180, 480] },
  { from: "shelter_access_degraded", to: "evacuation_demand", lag: [300, 720] },
];
export const CHAIN: Node[] = ["heavy_rain", ...CAUSAL_EDGES.map((e) => e.to)];

export const NODE_LABEL: Record<Node, string> = {
  heavy_rain: "Heavy rain",
  drainage_anomaly: "Drainage overflow",
  traffic_slowdown: "Road closures",
  citizen_flood_report: "Citizen reports",
  camera_water_detected: "Visual flooding",
  emergency_call_spike: "Emergency call spike",
  hospital_surge: "Hospital surge",
  gateway_outage_confirmed: "Gateway outage",
  shelter_access_degraded: "Shelter access degraded",
  evacuation_demand: "Evacuation demand",
  traffic_recovering: "Traffic recovering",
  rain_easing: "Rain easing",
};

/** Map feature associated with each predicted node, per zone. */
export const NODE_FEATURE: Partial<Record<Node, (z: ZoneId) => string>> = {
  drainage_anomaly: (z) => `culverts-${z}`,
  traffic_slowdown: (z) => `roads-${z}`,
  emergency_call_spike: (z) => `zone-${z}`,
  hospital_surge: () => "hospital-st-aldric",
  shelter_access_degraded: () => "shelter-north",
  evacuation_demand: (z) => `zone-${z}`,
};

export function mostExposedZone(events: IngestedEvent[], t: number): ZoneId {
  const acc: Partial<Record<ZoneId, number>> = {};
  for (const e of events) {
    if (e.retracted || e.offline || t - e.t > WINDOW_S || e.t > t) continue;
    const w = TYPE_WEIGHT[e.type] ?? 0;
    if (w <= 0) continue;
    acc[e.zone] = (acc[e.zone] ?? 0) + w * e.reliability_at_ingest;
  }
  let best: ZoneId = "riverside";
  for (const [z, v] of Object.entries(acc)) if (v > (acc[best] ?? 0)) best = z as ZoneId;
  return best;
}

export function zoneExposure(events: IngestedEvent[], t: number): Record<ZoneId, number> {
  const acc: Record<ZoneId, number> = { riverside: 0, old_town: 0, harbor: 0, uplands: 0 };
  for (const e of events) {
    if (e.retracted || e.offline || t - e.t > WINDOW_S || e.t > t) continue;
    const w = TYPE_WEIGHT[e.type] ?? 0;
    if (w > 0) acc[e.zone] += w * e.reliability_at_ingest;
  }
  return acc;
}

/** Walk forward from the furthest observed chain node and project the next three events. */
export function foresee(
  events: IngestedEvent[],
  t: number,
  pCrisis: number,
  sources?: Source[],
): PredictedEvent[] {
  const live = events.filter((e) => !e.retracted && !e.offline && t - e.t <= WINDOW_S && e.t <= t);
  const zone = mostExposedZone(events, t);

  // Set of observed (type + location)
  const observedKeys = new Set(
    live.map((e) => {
      const loc = NODE_FEATURE[e.type as Node]?.(e.zone) ?? `zone-${e.zone}`;
      return `${e.type}:${loc}`;
    }),
  );

  const observedNodes = new Map<Node, IngestedEvent>();
  for (const e of live) {
    const node = e.type as Node;
    if (CHAIN.includes(node)) {
      const existing = observedNodes.get(node);
      if (!existing || e.t > existing.t) {
        observedNodes.set(node, e);
      }
    }
  }

  const hasOffline = sources ? sources.some((s) => s.status === "offline") : false;

  // If live is empty, fallback to 3 low-confidence predictions rooted at heavy_rain
  if (live.length === 0) {
    const out: PredictedEvent[] = [];
    let start = t;
    let end = t;
    const because = ["heavy_rain"];
    for (let k = 0; k < 3; k++) {
      const edge = CAUSAL_EDGES[k]!;
      start += edge.lag[0];
      end += edge.lag[1];
      const wStart = start;
      let wEnd = end;
      let conf = Math.min(0.15, Math.max(0.04, 0.15 * Math.pow(0.8, k)));
      if (hasOffline) {
        const span = wEnd - wStart;
        wEnd = wStart + Math.round(span * 1.3);
        conf *= 0.8;
      }
      out.push({
        event_type: edge.to,
        label: NODE_LABEL[edge.to],
        window_start: wStart,
        window_end: Math.max(wStart + 10, wEnd),
        location: NODE_FEATURE[edge.to]?.(zone) ?? `zone-${zone}`,
        confidence: conf,
        because: [...because, edge.to],
      });
      because.push(edge.to);
    }
    return out;
  }

  // Find deepest observed node index in CHAIN
  let rootIdx = 0;
  let rootEvent: IngestedEvent | undefined;
  CHAIN.forEach((n, i) => {
    if (observedNodes.has(n)) {
      rootIdx = i;
      rootEvent = observedNodes.get(n);
    }
  });

  const parentReliabilities: number[] = [];
  if (sources && sources.length > 0) {
    for (const e of live) {
      const s = sources.find((x) => x.id === e.source);
      if (s) parentReliabilities.push(s.current_reliability);
    }
  }
  const meanTrust =
    parentReliabilities.length > 0
      ? parentReliabilities.reduce((a, b) => a + b, 0) / parentReliabilities.length
      : 0.8;

  const out: PredictedEvent[] = [];
  let currentStart = rootEvent ? rootEvent.t : t;
  let currentEnd = rootEvent ? rootEvent.t : t;
  const currentPath: string[] = [CHAIN[rootIdx]!];

  for (let idx = rootIdx; idx < CAUSAL_EDGES.length && out.length < 3; idx++) {
    const edge = CAUSAL_EDGES[idx];
    if (!edge) break;
    currentStart += edge.lag[0];
    currentEnd += edge.lag[1];
    currentPath.push(edge.to);

    const location = NODE_FEATURE[edge.to]?.(zone) ?? `zone-${zone}`;
    const key = `${edge.to}:${location}`;
    if (observedKeys.has(key)) {
      continue;
    }

    const step = out.length + 1;
    const edgeConf = Math.pow(0.85, step);
    let conf = Math.max(0.05, Math.min(0.97, edgeConf * pCrisis * meanTrust));
    const wStart = Math.max(t + 10, currentStart);
    let wEnd = Math.max(wStart + 20, currentEnd);

    if (hasOffline) {
      const span = wEnd - wStart;
      wEnd = wStart + Math.round(span * 1.3);
      conf *= 0.8;
    }

    out.push({
      event_type: edge.to,
      label: NODE_LABEL[edge.to],
      window_start: wStart,
      window_end: wEnd,
      location,
      confidence: conf,
      because: [...currentPath],
    });
  }

  // If still fewer than 3 predictions, pad downstream or repeat safely
  while (out.length < 3) {
    const last = out.at(-1);
    const wStart = last ? last.window_end + 30 : t + 60;
    const wEnd = wStart + 180;
    const fallbackNode: Node = out.length === 2 ? "evacuation_demand" : "shelter_access_degraded";
    out.push({
      event_type: fallbackNode,
      label: NODE_LABEL[fallbackNode],
      window_start: wStart,
      window_end: wEnd,
      location: NODE_FEATURE[fallbackNode]?.(zone) ?? `zone-${zone}`,
      confidence: Math.max(0.05, (last?.confidence ?? 0.3) * 0.75),
      because: last ? [...last.because, fallbackNode] : ["heavy_rain", fallbackNode],
    });
  }

  return out.sort((a, b) => a.window_start - b.window_start);
}
