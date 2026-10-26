import { describe, expect, it } from "vitest";
import { Episode } from "./engine";
import { ACTIONS, type Action, type ScriptedEvent } from "./types";
import { EMPTY_MEMORY } from "./learning";

function mulberry32(seed: number) {
  let s = seed;
  return function () {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type EpisodeKind =
  "crisis" | "rain-only" | "gateway outage" | "rumor wave" | "sensor spam" | "flu cluster";

function generateEpisode(
  kind: EpisodeKind,
  rand: () => number,
  idPrefix: string,
): { events: ScriptedEvent[]; isCrisis: boolean } {
  const events: ScriptedEvent[] = [];
  const zones = ["riverside", "old_town", "harbor", "uplands"] as const;

  switch (kind) {
    case "crisis": {
      events.push({
        id: `${idPrefix}_rain`,
        t: 0,
        source: "weather",
        type: "heavy_rain",
        zone: "riverside",
        text: "Severe rain system 40mm/h",
      });
      events.push({
        id: `${idPrefix}_d1`,
        t: 30 + Math.floor(rand() * 20),
        source: "drainage",
        type: "drainage_anomaly",
        zone: "riverside",
        gateway: "GW-2",
        text: "Culvert spill",
      });
      events.push({
        id: `${idPrefix}_d2`,
        t: 90 + Math.floor(rand() * 20),
        source: "drainage",
        type: "drainage_anomaly",
        zone: "riverside",
        gateway: "GW-2",
        text: "Secondary culvert pressure rise",
      });
      events.push({
        id: `${idPrefix}_c1`,
        t: 120 + Math.floor(rand() * 30),
        source: "citizen",
        type: "citizen_flood_report",
        zone: "riverside",
        text: "Deep street flooding reported",
      });
      events.push({
        id: `${idPrefix}_cam1`,
        t: 160 + Math.floor(rand() * 30),
        source: "camera",
        type: "camera_water_detected",
        zone: "old_town",
        text: "Road submerged",
      });
      events.push({
        id: `${idPrefix}_disp1`,
        t: 240 + Math.floor(rand() * 30),
        source: "dispatch",
        type: "emergency_call_spike",
        zone: "riverside",
        text: "Multiple distress calls",
      });
      events.push({
        id: `${idPrefix}_hosp1`,
        t: 290 + Math.floor(rand() * 30),
        source: "hospital",
        type: "hospital_surge",
        zone: "old_town",
        text: "Emergency department at capacity",
      });
      events.push({
        id: `${idPrefix}_hosp2`,
        t: 350 + Math.floor(rand() * 20),
        source: "hospital",
        type: "hospital_surge",
        zone: "riverside",
        text: "Casualty ward diverted",
      });
      return { events, isCrisis: true };
    }

    case "rain-only": {
      events.push({
        id: `${idPrefix}_rain`,
        t: 0,
        source: "weather",
        type: "heavy_rain",
        zone: "riverside",
        text: "Rain passing through",
      });
      events.push({
        id: `${idPrefix}_cit`,
        t: 60 + Math.floor(rand() * 40),
        source: "citizen",
        type: "citizen_flood_report",
        zone: "riverside",
        text: "Puddles along gutter",
      });
      events.push({
        id: `${idPrefix}_ease`,
        t: 200 + Math.floor(rand() * 50),
        source: "weather",
        type: "rain_easing",
        zone: "riverside",
        text: "Rain diminishing",
      });
      return { events, isCrisis: false };
    }

    case "gateway outage": {
      events.push({
        id: `${idPrefix}_rain`,
        t: 0,
        source: "weather",
        type: "heavy_rain",
        zone: "riverside",
        text: "Moderate downpour",
      });
      const retIds: string[] = [];
      for (let i = 0; i < 4; i++) {
        const id = `${idPrefix}_gw_d${i}`;
        retIds.push(id);
        events.push({
          id,
          t: 30 + i * 35,
          source: "drainage",
          type: "drainage_anomaly",
          zone: "riverside",
          gateway: "GW-2",
          text: `Telemetry spike D${i}`,
        });
      }
      events.push({
        id: `${idPrefix}_gw_fault`,
        t: 240,
        source: "gateway",
        type: "gateway_outage_confirmed",
        zone: "riverside",
        text: "GW-2 telemetry corrupted",
        retracts: retIds,
      });
      events.push({
        id: `${idPrefix}_recovering`,
        t: 300,
        source: "traffic",
        type: "traffic_recovering",
        zone: "riverside",
        text: "Traffic clearing normally",
      });
      return { events, isCrisis: false };
    }

    case "rumor wave": {
      events.push({
        id: `${idPrefix}_rain`,
        t: 0,
        source: "weather",
        type: "heavy_rain",
        zone: "riverside",
        text: "Rainfront",
      });
      const count = 12 + Math.floor(rand() * 8);
      for (let i = 0; i < count; i++) {
        events.push({
          id: `${idPrefix}_rumor_${i}`,
          t: 20 + Math.floor(i * (260 / count)),
          source: "citizen",
          type: "citizen_flood_report",
          zone: "riverside",
          text: `Citizen rumor chatter #${i}`,
        });
      }
      return { events, isCrisis: false };
    }

    case "sensor spam": {
      const count = 8 + Math.floor(rand() * 4);
      for (let i = 0; i < count; i++) {
        events.push({
          id: `${idPrefix}_spam_${i}`,
          t: 10 + i * 20,
          source: "drainage",
          type: "drainage_anomaly",
          zone: "riverside",
          gateway: "GW-2",
          text: `Sensor chatter ${i}`,
        });
      }
      return { events, isCrisis: false };
    }

    case "flu cluster": {
      events.push({
        id: `${idPrefix}_flu1`,
        t: 60 + Math.floor(rand() * 30),
        source: "hospital",
        type: "hospital_surge",
        zone: "old_town",
        text: "Hospital respiratory triage surge",
      });
      events.push({
        id: `${idPrefix}_flu2`,
        t: 180 + Math.floor(rand() * 40),
        source: "hospital",
        type: "hospital_surge",
        zone: "old_town",
        text: "Pediatric ward flu intake",
      });
      return { events, isCrisis: false };
    }
  }
}

describe("Engine Calibration and Stress Test (300 episodes)", () => {
  it("evaluates Brier, ECE, false-ESCALATE, hit rate, and reversals", () => {
    const rand = mulberry32(42);
    const kinds: EpisodeKind[] = [
      "crisis",
      "rain-only",
      "gateway outage",
      "rumor wave",
      "sensor spam",
      "flu cluster",
    ];

    const totalEpisodes = 300;
    const brierDeltas210: number[] = [];
    const brierDeltas300: number[] = [];
    const p300List: { p: number; truth: number }[] = [];

    let falseEscalateCount = 0;
    let nonCrisisCount = 0;
    let crisisCount = 0;
    let crisisHitCount = 0;
    let totalReversals = 0;

    for (let i = 0; i < totalEpisodes; i++) {
      const kind = kinds[i % kinds.length]!;
      const { events, isCrisis } = generateEpisode(kind, rand, `ep_${i}`);
      const truth = isCrisis ? 1 : 0;

      if (isCrisis) crisisCount++;
      else nonCrisisCount++;

      const ep = new Episode("branch_b", EMPTY_MEMORY);
      ep.script = events;
      ep.duration = 420;

      let p210 = 0;
      let p300 = 0;
      let everEscalate = false;
      let hitBy360 = false;
      const actions: Action[] = [];

      let iter = 0;
      while (!ep.done() && iter < 100) {
        const snap = ep.tick(30);
        iter++;
        actions.push(snap.decision.action);

        if (snap.t <= 210) p210 = snap.decision.p_crisis;
        if (snap.t <= 300) p300 = snap.decision.p_crisis;
        if (snap.decision.action === "ESCALATE") everEscalate = true;
        if (
          snap.t <= 360 &&
          (snap.decision.action === "ALERT" || snap.decision.action === "ESCALATE")
        ) {
          hitBy360 = true;
        }
      }

      brierDeltas210.push(Math.pow(p210 - truth, 2));
      brierDeltas300.push(Math.pow(p300 - truth, 2));
      p300List.push({ p: p300, truth });

      if (!isCrisis && everEscalate) falseEscalateCount++;
      if (isCrisis && hitBy360) crisisHitCount++;

      // Count direction reversals
      const indices = actions.map((a) => ACTIONS.indexOf(a));
      let currentDir = 0;
      let reversals = 0;
      for (let j = 1; j < indices.length; j++) {
        const diff = indices[j]! - indices[j - 1]!;
        if (diff > 0) {
          if (currentDir < 0) reversals++;
          currentDir = 1;
        } else if (diff < 0) {
          if (currentDir > 0) reversals++;
          currentDir = -1;
        }
      }
      totalReversals += reversals;
    }

    const brier210 = brierDeltas210.reduce((a, b) => a + b, 0) / totalEpisodes;
    const brier300 = brierDeltas300.reduce((a, b) => a + b, 0) / totalEpisodes;

    // ECE across 5 bins on p300
    const binCount = 5;
    let ece = 0;
    for (let b = 0; b < binCount; b++) {
      const lo = b / binCount;
      const hi = (b + 1) / binCount;
      const inBin = p300List.filter(
        (item) => item.p >= lo && (b === binCount - 1 ? item.p <= hi : item.p < hi),
      );
      if (inBin.length > 0) {
        const avgP = inBin.reduce((acc, cur) => acc + cur.p, 0) / inBin.length;
        const avgTruth = inBin.reduce((acc, cur) => acc + cur.truth, 0) / inBin.length;
        ece += (inBin.length / totalEpisodes) * Math.abs(avgTruth - avgP);
      }
    }

    const falseEscalateRate = falseEscalateCount / nonCrisisCount;
    const crisisHitRate = crisisHitCount / crisisCount;
    const avgReversals = totalReversals / totalEpisodes;

    console.log("=== CALIBRATION & BENCHMARK RESULTS (300 episodes) ===");
    console.log(`Brier Score (t=210): ${brier210.toFixed(4)}`);
    console.log(`Brier Score (t=300): ${brier300.toFixed(4)}`);
    console.log(`Expected Calibration Error (ECE, 5 bins @ t=300): ${ece.toFixed(4)}`);
    console.log(
      `False ESCALATE Rate: ${(falseEscalateRate * 100).toFixed(2)}% (${falseEscalateCount}/${nonCrisisCount})`,
    );
    console.log(
      `Crisis Hit Rate (by t=360): ${(crisisHitRate * 100).toFixed(2)}% (${crisisHitCount}/${crisisCount})`,
    );
    console.log(`Mean Action Reversals per Episode: ${avgReversals.toFixed(3)}`);
    console.log("=====================================================");

    expect(falseEscalateRate).toBeLessThan(0.1);
    expect(crisisHitRate).toBeGreaterThanOrEqual(0.9);
    expect(ece).toBeLessThan(0.2);
  });
});
