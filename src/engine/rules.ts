/**
 * Layer 1 + Layer 2 — signal scoring and the hypothesis rule set.
 * This is the file to read to answer "how does it think".
 */
import type {
  Belief,
  Contribution,
  EventType,
  Hypothesis,
  IngestedEvent,
  Prior,
  Source,
} from "./types";

/** How strongly one fully-reliable observation of each type pushes toward "crisis". */
export const TYPE_WEIGHT: Record<EventType, number> = {
  drainage_anomaly: 0.25,
  hospital_surge: 0.3,
  emergency_call_spike: 0.2,
  traffic_slowdown: 0.1,
  heavy_rain: 0.05,
  citizen_flood_report: 0.12,
  camera_water_detected: 0.15,
  gateway_outage_confirmed: -0.4, // a retraction signal pushes the score down
  traffic_recovering: -0.1,
  rain_easing: -0.05,
};

/** Rolling evidence window (virtual seconds). */
export const WINDOW_S = 300;
/** Sources considered "trusted" for corroboration. */
export const TRUSTED_RELIABILITY = 0.76;

export const DEFAULT_PRIOR: Prior = { crisisOdds: 1, rainNormality: 0.5, falseAlarms: 0 };

export const logistic = (raw: number) => 1 / (1 + Math.exp(-4 * (raw - 0.5)));

const RAIN_EXPLAINABLE: EventType[] = [
  "drainage_anomaly",
  "traffic_slowdown",
  "citizen_flood_report",
  "camera_water_detected",
];
export const SAME_SOURCE_DECAY = 0.5;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Layer 1: signal scoring with repetition decay and rain discounts. */
export function scoreSignals(events: IngestedEvent[], t: number, rainDiscount = 0.5) {
  const explanation: Contribution[] = [];
  const live: IngestedEvent[] = [];
  for (const e of events) {
    if (t - e.t > WINDOW_S || e.t > t) continue;
    if (e.retracted) {
      explanation.push({
        signal_id: e.id,
        contribution: 0,
        reason: `${e.type} retracted — excluded`,
      });
      continue;
    }
    if (e.offline) {
      explanation.push({
        signal_id: e.id,
        contribution: 0,
        reason: `source ${e.source} offline — excluded`,
      });
      continue;
    }
    live.push(e);
  }

  const rain = live.some((e) => e.type === "heavy_rain");
  const independent = live.some(
    (e) => e.type === "hospital_surge" || e.type === "emergency_call_spike",
  );
  const base = (e: IngestedEvent) => (TYPE_WEIGHT[e.type] ?? 0) * e.reliability_at_ingest;
  const seen: Record<string, number> = {};
  let raw = 0;

  const sortedLive = [...live].sort((a, b) => Math.abs(base(b)) - Math.abs(base(a)));

  for (const e of sortedLive) {
    let w = 1;
    const b = base(e);
    const why = [`${e.type} × r=${e.reliability_at_ingest.toFixed(2)}`];
    if (b > 0) {
      const key = e.gateway ?? e.source;
      const k = seen[key] ?? 0;
      seen[key] = k + 1;
      if (k > 0) {
        w *= Math.pow(SAME_SOURCE_DECAY, k);
        why.push(`repeat from ${key} ×${Math.pow(0.5, k).toFixed(2)}`);
      }
      if (rain && !independent && RAIN_EXPLAINABLE.includes(e.type)) {
        w *= rainDiscount;
        why.push(`explainable by heavy rain ×${rainDiscount.toFixed(2)}`);
      }
    }
    const c = b * w;
    raw += c;
    explanation.push({
      signal_id: e.id,
      contribution: c,
      reason: why.join(", "),
    });
  }

  raw = Math.max(raw, -1);
  return { raw, crisis_probability: logistic(raw), explanation };
}

/**
 * Layer 2: hypothesis distribution with prior shifts and anti-extremity mixing.
 */
export function hypothesize(
  events: IngestedEvent[],
  sources: Source[],
  t: number,
  prior: Prior = DEFAULT_PRIOR,
): Belief {
  const rainDiscount = clamp(0.7 - 0.4 * prior.rainNormality, 0.3, 0.7);
  const { raw, crisis_probability: cp, explanation } = scoreSignals(events, t, rainDiscount);
  const live = events.filter((e) => t - e.t <= WINDOW_S && e.t <= t && !e.retracted && !e.offline);
  const rel = (id: string) => sources.find((s) => s.id === id)?.current_reliability ?? 0;
  const positive = live.filter((e) => (TYPE_WEIGHT[e.type] ?? 0) > 0);
  const strong = positive.filter((e) => (TYPE_WEIGHT[e.type] ?? 0) >= 0.2);
  const outage = live.some((e) => e.type === "gateway_outage_confirmed");
  const retractions = events.filter((e) => e.retracted && t - e.t <= WINDOW_S).length;
  const srcClusterSet = new Set(positive.map((e) => e.gateway ?? e.source));
  const trusted = new Set(
    positive
      .filter((e) => rel(e.source) >= TRUSTED_RELIABILITY && e.source !== "weather")
      .map((e) => e.source),
  );
  const zones = new Set(positive.filter((e) => e.type !== "heavy_rain").map((e) => e.zone));
  const rules: string[] = [];

  let noise = Math.pow(1 - cp, 2) * 1.2;
  if (cp < 0.2 && strong.length === 0) {
    noise *= 2;
    rules.push("NOISE↑ p<0.2 and only weak signals");
  }
  if (outage && trusted.size < 3) {
    noise += 0.6;
    rules.push("NOISE↑ remaining evidence is weak after outage");
  }

  let sensor = 0.1;
  if (outage) {
    sensor += 1.4 + 0.15 * retractions;
    rules.push(`SENSOR_FAILURE↑ gateway outage confirmed (${retractions} retracted)`);
  }
  if (positive.length >= 2 && srcClusterSet.size === 1) {
    sensor += 0.6;
    rules.push("SENSOR_FAILURE↑ all signals from one source cluster");
  }

  let isolated = Math.exp(-Math.pow((cp - 0.45) / 0.17, 2)) * (zones.size <= 1 ? 1.2 : 0.55);
  if (zones.size === 1 && cp >= 0.3 && cp <= 0.6)
    rules.push("ISOLATED_INCIDENT↑ evidence localized to one zone");
  if (outage) isolated *= 0.5;

  let cascade = Math.pow(cp, 3) * 0.6;
  if (trusted.size >= 3 && cp > 0.55) {
    cascade =
      Math.pow(cp, 2) * (1.2 + 0.45 * (trusted.size - 3) + 0.6 * Math.max(0, zones.size - 1));
    rules.push(
      `CASCADING_CRISIS↑ ${trusted.size} trusted sources corroborate across ${zones.size} zone(s)`,
    );
  }

  cascade *= prior.crisisOdds;
  isolated *= Math.sqrt(prior.crisisOdds);

  const total = Math.max(1e-6, noise + sensor + isolated + cascade);
  const mix = (x: number) => 0.94 * (x / total) + 0.015;

  const distribution: Record<Hypothesis, number> = {
    NOISE: mix(noise),
    SENSOR_FAILURE: mix(sensor),
    ISOLATED_INCIDENT: mix(isolated),
    CASCADING_CRISIS: mix(cascade),
  };

  return {
    t,
    raw_score: raw,
    crisis_probability: cp,
    distribution,
    explanation,
    rules_fired: rules,
  };
}
