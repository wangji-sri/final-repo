import type { ScriptedEvent, Source } from "./types";

/** Source registry. Base reliabilities are documented priors. */
export const SOURCE_DEFS: Omit<Source, "current_reliability" | "status" | "history">[] = [
  { id: "drainage", name: "Drainage sensors", kind: "sensor", base_reliability: 0.78 },
  { id: "hospital", name: "Hospital feeds", kind: "hospital", base_reliability: 0.92 },
  { id: "traffic", name: "Traffic API", kind: "traffic", base_reliability: 0.74 },
  { id: "citizen", name: "Citizen reports", kind: "citizen", base_reliability: 0.48 },
  { id: "camera", name: "Camera grid", kind: "camera", base_reliability: 0.7 },
  { id: "dispatch", name: "Emergency dispatch", kind: "dispatch", base_reliability: 0.88 },
  { id: "weather", name: "Weather service", kind: "weather", base_reliability: 0.9 },
  { id: "gateway", name: "IoT gateway ops", kind: "gateway", base_reliability: 0.95 },
];

const PREFIX: ScriptedEvent[] = [
  {
    id: "e01",
    t: 0,
    source: "weather",
    type: "heavy_rain",
    zone: "riverside",
    text: "Rainfall 38 mm/h over the Riverside basin",
  },
  {
    id: "e02",
    t: 30,
    source: "drainage",
    type: "drainage_anomaly",
    gateway: "GW-2",
    zone: "riverside",
    text: "Culvert R-14 water level +42 cm in 6 min",
  },
  {
    id: "e03",
    t: 60,
    source: "citizen",
    type: "citizen_flood_report",
    zone: "riverside",
    text: '"Water coming over the curb on Mill St"',
  },
  {
    id: "e04",
    t: 90,
    source: "drainage",
    type: "drainage_anomaly",
    gateway: "GW-2",
    zone: "riverside",
    text: "Culvert R-17 pressure spike, pump P-3 lagging",
  },
  {
    id: "e05",
    t: 120,
    source: "traffic",
    type: "traffic_slowdown",
    zone: "riverside",
    text: "Mill St / River Rd speeds down 61%",
  },
  {
    id: "e06",
    t: 150,
    source: "camera",
    type: "camera_water_detected",
    zone: "old_town",
    text: "Cam OT-08 detects standing water at underpass",
  },
  {
    id: "e07",
    t: 210,
    source: "drainage",
    type: "drainage_anomaly",
    gateway: "GW-2",
    zone: "old_town",
    text: "Culvert O-03 water level +55 cm",
  },
];

export const BRANCH_A: ScriptedEvent[] = [
  ...PREFIX,
  {
    id: "a08",
    t: 240,
    source: "dispatch",
    type: "emergency_call_spike",
    zone: "riverside",
    text: "Dispatch: 14 water-related calls in 4 min",
  },
  {
    id: "a09",
    t: 270,
    source: "traffic",
    type: "traffic_slowdown",
    zone: "old_town",
    text: "Underpass closure, Harbor Rd backing up",
  },
  {
    id: "a10",
    t: 300,
    source: "hospital",
    type: "hospital_surge",
    zone: "old_town",
    text: "St. Aldric ED: arrivals 2.3× baseline",
  },
  {
    id: "a11",
    t: 360,
    source: "dispatch",
    type: "emergency_call_spike",
    zone: "old_town",
    text: "Dispatch: trapped-vehicle reports, Old Town",
  },
  {
    id: "a12",
    t: 420,
    source: "hospital",
    type: "hospital_surge",
    zone: "riverside",
    text: "Riverside General diverting ambulances",
  },
];

export const BRANCH_B: ScriptedEvent[] = [
  ...PREFIX,
  {
    id: "b08",
    t: 240,
    source: "gateway",
    type: "gateway_outage_confirmed",
    zone: "riverside",
    text: "Gateway GW-2 firmware fault confirmed — drainage telemetry invalid since 23:58",
    retracts: ["e02", "e04", "e07"],
  },
  {
    id: "b09",
    t: 300,
    source: "traffic",
    type: "traffic_recovering",
    zone: "riverside",
    text: "Mill St speeds recovering (−18%)",
  },
  {
    id: "b10",
    t: 360,
    source: "weather",
    type: "rain_easing",
    zone: "riverside",
    text: "Rainfall easing to 9 mm/h",
  },
];

export const CUTOUT_DEMO: ScriptedEvent[] = [
  ...PREFIX.slice(0, 5),
  {
    id: "c06",
    t: 150,
    source: "dispatch",
    type: "emergency_call_spike",
    zone: "riverside",
    text: "Dispatch: 9 water-related calls in 3 min",
  },
  {
    id: "c07",
    t: 210,
    source: "camera",
    type: "camera_water_detected",
    zone: "riverside",
    text: "Cam R-02 detects water across lanes",
  },
  {
    id: "c08",
    t: 300,
    source: "hospital",
    type: "hospital_surge",
    zone: "riverside",
    text: "Riverside General: arrivals 1.6× baseline",
  },
];

// Helper to construct messy_stream
function buildMessyStream(): ScriptedEvent[] {
  const events: ScriptedEvent[] = [
    {
      id: "m_rain",
      t: 0,
      source: "weather",
      type: "heavy_rain",
      zone: "riverside",
      text: "Heavy rain front over riverside 35 mm/h",
    },
  ];

  // 6 drainage anomalies tagged GW-2 within 120 s
  const drainageTimes = [15, 30, 50, 70, 90, 110];
  drainageTimes.forEach((t, i) => {
    events.push({
      id: `m_d${i + 1}`,
      t,
      source: "drainage",
      type: "drainage_anomaly",
      zone: "riverside",
      gateway: "GW-2",
      text: `Culvert spike anomaly D-${i + 1}`,
    });
  });

  // 18 citizen reports t=20..300 (rumor wave)
  for (let i = 0; i < 18; i++) {
    const t = Math.round(20 + i * (280 / 17));
    events.push({
      id: `m_c${i + 1}`,
      t,
      source: "citizen",
      type: "citizen_flood_report",
      zone: "riverside",
      text: `Social post: flooding on block ${i + 1}`,
    });
  }

  // 4 exact duplicate re-sends (same id)
  events.push(
    { ...events[1]!, t: 40 },
    { ...events[2]!, t: 60 },
    { ...events[7]!, t: 80 },
    { ...events[8]!, t: 100 },
  );

  // 2 near-duplicates (same source+type+zone within 10s)
  events.push({
    id: "m_nd1",
    t: 24, // within 4s of m_c1 at 20
    source: "citizen",
    type: "citizen_flood_report",
    zone: "riverside",
    text: "Near duplicate report block 1",
  });
  events.push({
    id: "m_nd2",
    t: 74, // within 4s of m_d4 at 70
    source: "drainage",
    type: "drainage_anomaly",
    zone: "riverside",
    gateway: "GW-2",
    text: "Near duplicate drainage spike D-4",
  });

  // 2 events with arrival_t = t+90 (late / out-of-order)
  events.push({
    id: "m_late1",
    t: 100,
    arrival_t: 190,
    source: "traffic",
    type: "traffic_slowdown",
    zone: "riverside",
    text: "Delayed traffic queue log",
  });
  events.push({
    id: "m_late2",
    t: 130,
    arrival_t: 220,
    source: "camera",
    type: "camera_water_detected",
    zone: "riverside",
    text: "Buffered camera frame water detected",
  });

  // One normal storm-call dispatch at t=200
  events.push({
    id: "m_disp",
    t: 200,
    source: "dispatch",
    type: "citizen_flood_report",
    zone: "riverside",
    text: "Dispatch: normal storm call received",
  });

  // At t=270 gateway_outage_confirmed retracting the 6 drainage ids
  events.push({
    id: "m_gw_outage",
    t: 270,
    source: "gateway",
    type: "gateway_outage_confirmed",
    zone: "riverside",
    text: "GW-2 outage confirmed — sensor anomalies retracted",
    retracts: ["m_d1", "m_d2", "m_d3", "m_d4", "m_d5", "m_d6"],
  });

  return events;
}

export const MESSY_STREAM: ScriptedEvent[] = buildMessyStream();

export type EpisodeName = "branch_a" | "branch_b" | "cutout_demo" | "messy_stream";
export const EPISODES: Record<
  EpisodeName,
  {
    label: string;
    truth: "crisis" | "false_alarm";
    events: ScriptedEvent[];
    duration: number;
    autoCutout?: { t: number; sources: string[] };
  }
> = {
  branch_a: { label: "Branch A · crisis", truth: "crisis", events: BRANCH_A, duration: 480 },
  branch_b: {
    label: "Branch B · false alarm",
    truth: "false_alarm",
    events: BRANCH_B,
    duration: 480,
  },
  cutout_demo: {
    label: "Cutout demo",
    truth: "crisis",
    events: CUTOUT_DEMO,
    duration: 420,
    autoCutout: { t: 180, sources: ["camera", "drainage", "citizen"] },
  },
  messy_stream: {
    label: "Messy stream · false alarm",
    truth: "false_alarm",
    events: MESSY_STREAM,
    duration: 480,
  },
};
