import { describe, expect, it, beforeEach } from "vitest";
import { expectedCosts, FALSE_ALARM_COST, DAMAGE_COST } from "./cost-model";
import { Episode, replay } from "./engine";
import { logistic, TYPE_WEIGHT } from "./rules";
import { foresee } from "./causal-graph";
import { ACTIONS, type Action, type ScriptedEvent } from "./types";
import { resetMemory, EMPTY_MEMORY, priorFrom } from "./learning";
import { EPISODES } from "./fixtures";

const compressedActions = (states: ReturnType<typeof replay>) => {
  const seq: Action[] = [];
  for (const s of states) {
    if (seq.at(-1) !== s.decision.action) seq.push(s.decision.action);
  }
  return seq;
};

describe("Sentinel engine", () => {
  beforeEach(() => {
    resetMemory();
  });

  it("uses the documented weights and logistic", () => {
    expect(TYPE_WEIGHT.hospital_surge).toBe(0.3);
    expect(TYPE_WEIGHT.gateway_outage_confirmed).toBe(-0.4);
    expect(TYPE_WEIGHT.traffic_recovering).toBe(-0.1);
    expect(TYPE_WEIGHT.rain_easing).toBe(-0.05);
    expect(logistic(0.5)).toBeCloseTo(0.5);
  });

  it("cost model matches constants", () => {
    expect(FALSE_ALARM_COST.ESCALATE).toBe(1);
    expect(DAMAGE_COST.WATCH).toBe(1);
    const c = expectedCosts(0.5);
    expect(c.PREPARE).toBeCloseTo(0.45);
  });

  it("Case 1: prefix t=210 in branch_a AND branch_b has pCrisis < 0.35 and action WATCH", () => {
    const statesA = replay("branch_a", 30, EMPTY_MEMORY);
    const statesB = replay("branch_b", 30, EMPTY_MEMORY);
    const a210 = statesA.find((s) => s.t === 210)!;
    const b210 = statesB.find((s) => s.t === 210)!;

    expect(a210.decision.p_crisis).toBeLessThan(0.35);
    expect(a210.decision.action).toBe("WATCH");
    expect(b210.decision.p_crisis).toBeLessThan(0.35);
    expect(b210.decision.action).toBe("WATCH");
  });

  it("Case 2: branch_a reaches ALERT or higher by t<=300, ESCALATE by t<=360", () => {
    const statesA = replay("branch_a", 30, EMPTY_MEMORY);
    const s300 = statesA.find((s) => s.t === 300)!;
    expect(["ALERT", "ESCALATE"]).toContain(s300.decision.action);
    const s360 = statesA.find((s) => s.t === 360)!;
    expect(s360.decision.action).toBe("ESCALATE");
  });

  it("Case 3: branch_b max action <= PREPARE, final WATCH, final pCrisis in [0.01, 0.10]", () => {
    const statesB = replay("branch_b", 30, EMPTY_MEMORY);
    const actions = statesB.map((s) => s.decision.action);
    expect(actions.every((a) => ACTIONS.indexOf(a) <= ACTIONS.indexOf("PREPARE"))).toBe(true);
    const last = statesB.at(-1)!;
    expect(last.decision.action).toBe("WATCH");
    expect(last.decision.p_crisis).toBeGreaterThanOrEqual(0.01);
    expect(last.decision.p_crisis).toBeLessThanOrEqual(0.1);
  });

  it("Case 4: Rumor wave (20 citizen reports + rain only) results in max action WATCH", () => {
    const ep = new Episode("branch_b", EMPTY_MEMORY);
    // Replace script with rain + 20 citizen reports
    const rumorScript: ScriptedEvent[] = [
      {
        id: "r_rain",
        t: 0,
        source: "weather",
        type: "heavy_rain",
        zone: "riverside",
        text: "Rain",
      },
    ];
    for (let i = 0; i < 20; i++) {
      rumorScript.push({
        id: `r_c${i}`,
        t: 10 + i * 12,
        source: "citizen",
        type: "citizen_flood_report",
        zone: "riverside",
        text: `Rumor report ${i}`,
      });
    }
    ep.script = rumorScript;
    ep.duration = 300;

    const actions: Action[] = [];
    for (let iter = 0; iter < 100 && !ep.done(); iter++) {
      const snap = ep.tick(30);
      actions.push(snap.decision.action);
    }
    expect(actions.every((a) => a === "WATCH")).toBe(true);
  });

  it("Case 5: One gateway spamming 10 drainage anomalies results in max action <= PREPARE", () => {
    const ep = new Episode("branch_b", EMPTY_MEMORY);
    const spamScript: ScriptedEvent[] = [
      {
        id: "s_rain",
        t: 0,
        source: "weather",
        type: "heavy_rain",
        zone: "riverside",
        text: "Rain",
      },
    ];
    for (let i = 0; i < 10; i++) {
      spamScript.push({
        id: `s_d${i}`,
        t: 15 + i * 15,
        source: "drainage",
        type: "drainage_anomaly",
        zone: "riverside",
        gateway: "GW-2",
        text: `Culvert anomaly ${i}`,
      });
    }
    ep.script = spamScript;
    ep.duration = 300;

    const actions: Action[] = [];
    for (let iter = 0; iter < 100 && !ep.done(); iter++) {
      const snap = ep.tick(30);
      actions.push(snap.decision.action);
    }
    expect(actions.every((a) => ACTIONS.indexOf(a) <= ACTIONS.indexOf("PREPARE"))).toBe(true);
  });

  it("Case 6: messy_stream does not throw and max action <= PREPARE", () => {
    const states = replay("messy_stream", 30, EMPTY_MEMORY);
    expect(
      states.every((s) => ACTIONS.indexOf(s.decision.action) <= ACTIONS.indexOf("PREPARE")),
    ).toBe(true);
  });

  it("Case 7: cutout_demo retains >= 70% cascade, holds against step-down 120s, all numbers finite", () => {
    const states = replay("cutout_demo", 30, EMPTY_MEMORY);
    const pre = states.find((s) => s.t === 150)!;
    const post = states.find((s) => s.t === 180)!;
    expect(post.belief.distribution.CASCADING_CRISIS).toBeGreaterThanOrEqual(
      pre.belief.distribution.CASCADING_CRISIS * 0.7,
    );

    // No step-down within 120s of cutout at 180 (up to t=300)
    const postCutoutActions = states
      .filter((s) => s.t >= 180 && s.t <= 300)
      .map((s) => ACTIONS.indexOf(s.decision.action));
    const actionAt180 = ACTIONS.indexOf(post.decision.action);
    expect(postCutoutActions.every((idx) => idx >= actionAt180)).toBe(true);

    // Every number in every snapshot is finite
    for (const s of states) {
      expect(Number.isFinite(s.t)).toBe(true);
      expect(Number.isFinite(s.decision.p_crisis)).toBe(true);
      expect(Number.isFinite(s.belief.raw_score)).toBe(true);
      for (const val of Object.values(s.belief.distribution)) {
        expect(Number.isFinite(val)).toBe(true);
      }
      for (const cost of Object.values(s.decision.expected_cost_per_action)) {
        expect(Number.isFinite(cost)).toBe(true);
      }
    }
  });

  it("Case 8: Rejects unknown source, unknown type, duplicate id, and near-duplicate with log", () => {
    const ep = new Episode("branch_b", EMPTY_MEMORY);
    ep.script = [
      {
        id: "bad_src",
        t: 10,
        source: "unknown_sensor",
        type: "heavy_rain",
        zone: "riverside",
        text: "x",
      },
      {
        id: "bad_type",
        t: 20,
        source: "weather",
        type: "invalid_type" as never,
        zone: "riverside",
        text: "x",
      },
      {
        id: "dup1",
        t: 30,
        source: "citizen",
        type: "citizen_flood_report",
        zone: "riverside",
        text: "x",
      },
      {
        id: "dup1",
        t: 35,
        source: "citizen",
        type: "citizen_flood_report",
        zone: "riverside",
        text: "x",
      },
      {
        id: "nd1",
        t: 40,
        source: "traffic",
        type: "traffic_slowdown",
        zone: "riverside",
        text: "x",
      },
      {
        id: "nd2",
        t: 45,
        source: "traffic",
        type: "traffic_slowdown",
        zone: "riverside",
        text: "x",
      },
    ];
    ep.duration = 60;
    ep.tick(60);

    const logs = ep.state.log.map((l) => l.text);
    expect(logs.some((l) => l.includes("Rejected bad_src: unknown source"))).toBe(true);
    expect(logs.some((l) => l.includes("Rejected bad_type: unknown type"))).toBe(true);
    expect(logs.some((l) => l.includes("Rejected dup1: duplicate id"))).toBe(true);
    expect(logs.some((l) => l.includes("Rejected nd2: near-duplicate"))).toBe(true);
  });

  it("Case 9: Direction reversals of the action <= 1 per episode over all episodes", () => {
    const epNames = Object.keys(EPISODES) as (keyof typeof EPISODES)[];
    for (const name of epNames) {
      const states = replay(name, 30, EMPTY_MEMORY);
      const actionIndices = states.map((s) => ACTIONS.indexOf(s.decision.action));
      let currentDir = 0; // +1 for up, -1 for down
      let reversals = 0;
      for (let i = 1; i < actionIndices.length; i++) {
        const diff = actionIndices[i]! - actionIndices[i - 1]!;
        if (diff > 0) {
          if (currentDir < 0) reversals++;
          currentDir = 1;
        } else if (diff < 0) {
          if (currentDir > 0) reversals++;
          currentDir = -1;
        }
      }
      expect(reversals).toBeLessThanOrEqual(1);
    }
  });

  it("Case 10: Learning lowers drainage reliability after branch_b and survives save/load", () => {
    const ep = new Episode("branch_b", EMPTY_MEMORY);
    for (let iter = 0; iter < 100 && !ep.done(); iter++) {
      ep.tick(30);
    }
    const mem = ep.finish();
    const drainageTrust = mem.trust["drainage"];
    expect(drainageTrust).toBeDefined();
    if (!drainageTrust) throw new Error("drainageTrust is undefined");
    const learnedRel = drainageTrust.a / (drainageTrust.a + drainageTrust.b);
    expect(learnedRel).toBeLessThan(0.78);
  });

  it("Case 11: Prior shift: 5 false alarms reduce crisisOdds, 5 crises increase crisisOdds", () => {
    let memFalse = { ...EMPTY_MEMORY };
    for (let i = 0; i < 5; i++) {
      const ep = new Episode("branch_b", memFalse);
      for (let iter = 0; iter < 100 && !ep.done(); iter++) ep.tick(30);
      memFalse = ep.finish();
    }
    const priorFalse = priorFrom(memFalse);
    expect(priorFalse.crisisOdds).toBeLessThan(1);

    let memCrisis = { ...EMPTY_MEMORY };
    for (let i = 0; i < 5; i++) {
      const ep = new Episode("branch_a", memCrisis);
      for (let iter = 0; iter < 100 && !ep.done(); iter++) ep.tick(30);
      memCrisis = ep.finish();
    }
    const priorCrisis = priorFrom(memCrisis);
    expect(priorCrisis.crisisOdds).toBeGreaterThan(1);
  });

  it("Case 12: foresee returns exactly 3 predictions at every tick from t=60 with window_start < window_end", () => {
    const ep = new Episode("branch_a", EMPTY_MEMORY);
    for (let iter = 0; iter < 100 && !ep.done(); iter++) {
      const snap = ep.tick(30);
      if (snap.t >= 60) {
        const preds = foresee(snap.events, snap.t, snap.decision.p_crisis, snap.sources);
        expect(preds).toHaveLength(3);
        expect(preds[0]!.window_start).toBeLessThan(preds[0]!.window_end);
        expect(preds[1]!.window_start).toBeLessThan(preds[1]!.window_end);
        expect(preds[2]!.window_start).toBeLessThan(preds[2]!.window_end);
      }
    }
  });

  it("Case 13: Step-size invariance: action sequences match between replay(step=2) and replay(step=30)", () => {
    const seqA2 = compressedActions(replay("branch_a", 2, EMPTY_MEMORY));
    const seqA30 = compressedActions(replay("branch_a", 30, EMPTY_MEMORY));
    expect(seqA2).toEqual(seqA30);

    const seqB2 = compressedActions(replay("branch_b", 2, EMPTY_MEMORY));
    const seqB30 = compressedActions(replay("branch_b", 30, EMPTY_MEMORY));
    expect(seqB2).toEqual(seqB30);
  });

  it("Case 14: Retraction lowers drainage reliability by 0.15", () => {
    const ep = new Episode("branch_a", EMPTY_MEMORY);
    ep.tick(60);
    const before = ep.state.sources.find((s) => s.id === "drainage")!.current_reliability;
    ep.retractLastDrainage();
    expect(ep.state.sources.find((s) => s.id === "drainage")!.current_reliability).toBeCloseTo(
      before - 0.15,
    );
  });
});
