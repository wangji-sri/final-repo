export type Hypothesis = "NOISE" | "SENSOR_FAILURE" | "ISOLATED_INCIDENT" | "CASCADING_CRISIS";
export const HYPOTHESES: Hypothesis[] = [
  "NOISE",
  "SENSOR_FAILURE",
  "ISOLATED_INCIDENT",
  "CASCADING_CRISIS",
];
export const HYPOTHESIS_LABEL: Record<Hypothesis, string> = {
  NOISE: "Noise",
  SENSOR_FAILURE: "Sensor failure",
  ISOLATED_INCIDENT: "Isolated incident",
  CASCADING_CRISIS: "Cascading crisis",
};

export type Action = "WATCH" | "PREPARE" | "ALERT" | "ESCALATE";
export const ACTIONS: Action[] = ["WATCH", "PREPARE", "ALERT", "ESCALATE"];

export type SourceKind =
  "sensor" | "hospital" | "dispatch" | "citizen" | "camera" | "weather" | "traffic" | "gateway";
export type SourceStatus = "online" | "degraded" | "offline";

export type EventType =
  | "heavy_rain"
  | "drainage_anomaly"
  | "traffic_slowdown"
  | "citizen_flood_report"
  | "camera_water_detected"
  | "emergency_call_spike"
  | "hospital_surge"
  | "gateway_outage_confirmed"
  | "traffic_recovering"
  | "rain_easing";

export type ZoneId = "riverside" | "old_town" | "harbor" | "uplands";

export interface ScriptedEvent {
  id: string;
  t: number;
  arrival_t?: number;
  gateway?: string;
  source: string;
  type: EventType;
  zone: ZoneId;
  text: string;
  /** Optional: this event retracts earlier events of these ids when ingested. */
  retracts?: string[];
}

export interface IngestedEvent extends ScriptedEvent {
  reliability_at_ingest: number;
  retracted: boolean;
  offline: boolean;
}

export interface Source {
  id: string;
  name: string;
  kind: SourceKind;
  base_reliability: number;
  current_reliability: number;
  status: SourceStatus;
  offline_since?: number;
  history: { t: number; reliability: number }[];
}

export interface Contribution {
  signal_id: string;
  contribution: number;
  reason: string;
}

export interface Memory {
  trust: Record<string, { a: number; b: number }>;
  crisisRate: number;
  rainRate: number;
  falseAlarms: number;
  episodes: number;
}

export interface Prior {
  crisisOdds: number;
  rainNormality: number;
  falseAlarms: number;
}

export interface Belief {
  t: number;
  raw_score: number;
  crisis_probability: number;
  distribution: Record<Hypothesis, number>;
  explanation: Contribution[];
  rules_fired: string[];
}

export interface Decision {
  t: number;
  action: Action;
  argmin_action: Action;
  expected_cost_per_action: Record<Action, number>;
  p_crisis: number;
  reason: string;
  stability_lock: boolean;
  previous_action: Action | null;
}

export interface PredictedEvent {
  event_type: EventType | "shelter_access_degraded" | "evacuation_demand";
  label: string;
  window_start: number;
  window_end: number;
  location: string;
  confidence: number;
  because: string[];
}

export interface EngineState {
  t: number;
  events: IngestedEvent[];
  sources: Source[];
  belief: Belief;
  decision: Decision;
  predictions: PredictedEvent[];
  prior: Prior;
  why: { t: number; delta: number; top: Contribution[] };
  log: { t: number; kind: "decision" | "retract" | "cutout" | "info"; text: string }[];
}
