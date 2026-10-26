/** The stateful episode simulator. Pure TypeScript — runs identically in the browser and on the server. */
import { foresee } from "./causal-graph";
import { decide, pCrisisOf } from "./cost-model";
import { EPISODES, SOURCE_DEFS, type EpisodeName } from "./fixtures";
import { DEFAULT_PRIOR, hypothesize, TYPE_WEIGHT, WINDOW_S } from "./rules";
import {
  ACTIONS,
  type Action,
  type EngineState,
  type IngestedEvent,
  type Memory,
  type ScriptedEvent,
  type Source,
} from "./types";
import { EMPTY_MEMORY, learn, priorFrom } from "./learning";

export const CORROBORATION_GAIN = 0;
export const RETRACTION_PENALTY = 0.15;
export const CUTOUT_DECAY = 0.05;
/** An action must hold this long before stepping up again (escalation hysteresis). */
export const MIN_DWELL_S = 60;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export class Episode {
  name: EpisodeName;
  script: ScriptedEvent[];
  duration: number;
  state: EngineState;
  private cursor = 0;
  private autoCutoutDone = false;
  private lastChangeT = -Infinity;
  private lastCutoutT = -Infinity;
  private maxActionReached: Action = "WATCH";
  private memory: Memory | undefined = undefined;
  private prevBeliefScore = 0;
  private prevContributions: Map<string, number> = new Map();

  constructor(name: EpisodeName, memory?: Memory) {
    this.name = name;
    this.memory = memory;
    this.script = [...EPISODES[name].events].sort(
      (a, b) => (a.arrival_t ?? a.t) - (b.arrival_t ?? b.t),
    );
    this.duration = EPISODES[name].duration;

    const sources: Source[] = SOURCE_DEFS.map((s) => {
      let r = s.base_reliability;
      if (memory?.trust[s.id]) {
        const { a, b } = memory.trust[s.id]!;
        r = clamp(a / (a + b), 0.3, 0.97);
      }
      return {
        ...s,
        current_reliability: r,
        status: "online",
        history: [{ t: 0, reliability: r }],
      };
    });

    const prior = memory ? priorFrom(memory) : DEFAULT_PRIOR;
    const belief = hypothesize([], sources, 0, prior);
    this.prevBeliefScore = belief.raw_score;

    const logs: EngineState["log"] = [
      { t: 0, kind: "info", text: `Episode ${EPISODES[name].label} started. Holding WATCH.` },
    ];

    if (
      Math.abs(prior.crisisOdds - 1) / 1 > 0.25 ||
      Math.abs(prior.rainNormality - 0.5) / 0.5 > 0.25
    ) {
      logs.push({
        t: 0,
        kind: "info",
        text: `Prior shift detected: crisisOdds=${prior.crisisOdds.toFixed(2)}, rainNormality=${prior.rainNormality.toFixed(2)}`,
      });
    }

    this.state = {
      t: 0,
      events: [],
      sources,
      belief,
      decision: decide(belief, null, {
        minutes: 0,
        falseAlarms: prior.falseAlarms,
        sinceChangeS: Infinity,
      }),
      predictions: foresee([], 0, pCrisisOf(belief), sources),
      prior,
      why: { t: 0, delta: 0, top: [] },
      log: logs,
    };
  }

  private src(id: string) {
    return this.state.sources.find((s) => s.id === id)!;
  }

  private setRel(s: Source, r: number) {
    s.current_reliability = r;
    s.history.push({ t: this.state.t, reliability: r });
    if (s.history.length > 60) s.history.shift();
  }

  private ingest(se: ScriptedEvent) {
    const st = this.state;

    // a) Validation
    if (!st.sources.some((s) => s.id === se.source)) {
      st.log.push({
        t: st.t,
        kind: "info",
        text: `Rejected ${se.id}: unknown source ${se.source}`,
      });
      return;
    }
    if (!(se.type in TYPE_WEIGHT)) {
      st.log.push({ t: st.t, kind: "info", text: `Rejected ${se.id}: unknown type ${se.type}` });
      return;
    }
    if (st.events.some((e) => e.id === se.id)) {
      st.log.push({ t: st.t, kind: "info", text: `Rejected ${se.id}: duplicate id` });
      return;
    }
    const isNearDup = st.events.some(
      (e) =>
        !e.retracted &&
        !e.offline &&
        e.source === se.source &&
        e.type === se.type &&
        e.zone === se.zone &&
        Math.abs(se.t - e.t) <= 10,
    );
    if (isNearDup) {
      st.log.push({ t: st.t, kind: "info", text: `Rejected ${se.id}: near-duplicate within 10s` });
      return;
    }

    const s = this.src(se.source);
    const offline = s.status === "offline";
    const ev: IngestedEvent = {
      ...se,
      reliability_at_ingest: s.current_reliability,
      retracted: false,
      offline,
    };
    st.events.push(ev);

    if (se.type === "gateway_outage_confirmed") {
      st.log.push({
        t: st.t,
        kind: "info",
        text: "common-cause failure: no per-sensor penalty",
      });
      for (const rid of se.retracts ?? []) {
        this.retract(rid, false, false);
      }
    } else {
      for (const rid of se.retracts ?? []) {
        this.retract(rid, false, true);
      }
    }
  }

  retract(eventId: string, recompute = true, penalize = true) {
    const e = this.state.events.find((x) => x.id === eventId);
    if (!e || e.retracted) return false;
    e.retracted = true;
    const s = this.src(e.source);
    if (penalize) {
      this.setRel(s, clamp(s.current_reliability - RETRACTION_PENALTY, 0.05, 0.99));
    }
    this.state.log.push({
      t: this.state.t,
      kind: "retract",
      text: `Retracted ${e.id} (${e.type}) — ${s.name} reliability → ${s.current_reliability.toFixed(2)}`,
    });
    if (recompute) this.recompute();
    return true;
  }

  retractLastDrainage() {
    const last = [...this.state.events]
      .reverse()
      .find((e) => e.type === "drainage_anomaly" && !e.retracted);
    return last ? this.retract(last.id) : false;
  }

  cutout(ids: string[] = ["camera", "drainage", "citizen"]) {
    this.lastCutoutT = this.state.t;
    for (const id of ids) {
      const s = this.src(id);
      s.status = "offline";
      s.offline_since = this.state.t;
    }
    this.state.log.push({
      t: this.state.t,
      kind: "cutout",
      text: `${ids.length} sources offline — confidence reduced.`,
    });
    this.recompute();
  }

  restore(ids?: string[]) {
    const targetIds =
      ids ?? this.state.sources.filter((s) => s.status === "offline").map((s) => s.id);
    for (const id of targetIds) {
      const s = this.src(id);
      s.status = "online";
      delete s.offline_since;
    }
    this.state.log.push({
      t: this.state.t,
      kind: "info",
      text: `${targetIds.length} sources restored online.`,
    });
    this.recompute();
  }

  private recompute() {
    const st = this.state;
    const belief = hypothesize(st.events, st.sources, st.t, st.prior);

    // e) Widen belief if sources are lost
    const offlineNonSpecial = st.sources.filter(
      (s) => s.status === "offline" && s.id !== "weather" && s.id !== "gateway",
    ).length;
    const lost = Math.min(1, offlineNonSpecial / 6);
    if (lost > 0) {
      const dist = belief.distribution;
      dist.NOISE = (1 - 0.5 * lost) * dist.NOISE + 0.5 * lost * 0.25;
      dist.SENSOR_FAILURE = (1 - 0.5 * lost) * dist.SENSOR_FAILURE + 0.5 * lost * 0.25;
      dist.ISOLATED_INCIDENT = (1 - 0.5 * lost) * dist.ISOLATED_INCIDENT + 0.5 * lost * 0.25;
      dist.CASCADING_CRISIS = (1 - 0.5 * lost) * dist.CASCADING_CRISIS + 0.5 * lost * 0.25;
    }

    const prev = st.decision.action;

    // h) lead minutes calculation
    const livePositiveNonWeather = st.events.filter(
      (e) =>
        !e.retracted &&
        !e.offline &&
        st.t - e.t <= WINDOW_S &&
        e.t <= st.t &&
        (TYPE_WEIGHT[e.type] ?? 0) > 0 &&
        e.source !== "weather",
    );
    const earliestT =
      livePositiveNonWeather.length > 0
        ? Math.min(...livePositiveNonWeather.map((e) => e.t))
        : null;
    const minutes = earliestT !== null ? Math.max(0, (st.t - earliestT) / 60) : 0;
    const sinceChangeS = st.t - this.lastChangeT;

    let decision = decide(belief, prev, {
      minutes,
      falseAlarms: st.prior.falseAlarms,
      sinceChangeS,
    });

    // Hold-against-step-down only while t - lastCutoutT < 120
    const holdCutout =
      st.t - this.lastCutoutT < 120 && st.sources.some((s) => s.status === "offline");
    if (holdCutout && ACTIONS.indexOf(decision.action) < ACTIONS.indexOf(prev)) {
      decision = {
        ...decision,
        action: prev,
        stability_lock: true,
        reason: `Sources lost — absence of data is not evidence. Stability lock holds ${prev} (cutout window active).`,
      };
    }

    // 60s up-dwell lock
    if (
      ACTIONS.indexOf(decision.action) > ACTIONS.indexOf(prev) &&
      st.t - this.lastChangeT < MIN_DWELL_S
    ) {
      decision = {
        ...decision,
        action: prev,
        stability_lock: true,
        reason: `${decision.action} is cheaper, but ${prev} was set ${Math.round(st.t - this.lastChangeT)}s ago — dwell lock holds until ${MIN_DWELL_S}s.`,
      };
    }

    if (decision.action !== prev) {
      this.lastChangeT = st.t;
      st.log.push({
        t: st.t,
        kind: "decision",
        text: `${prev} → ${decision.action}. ${decision.reason}`,
      });
    }

    if (ACTIONS.indexOf(decision.action) > ACTIONS.indexOf(this.maxActionReached)) {
      this.maxActionReached = decision.action;
    }

    // i) why computation
    const delta = belief.raw_score - this.prevBeliefScore;
    this.prevBeliefScore = belief.raw_score;

    const currentContributions = new Map<string, { c: number; reason: string }>();
    for (const exp of belief.explanation) {
      currentContributions.set(exp.signal_id, { c: exp.contribution, reason: exp.reason });
    }

    const diffs: { signal_id: string; contribution: number; reason: string }[] = [];
    const allIds = new Set([...this.prevContributions.keys(), ...currentContributions.keys()]);
    for (const id of allIds) {
      const cur = currentContributions.get(id);
      const curVal = cur ? cur.c : 0;
      const prevVal = this.prevContributions.get(id) ?? 0;
      const change = curVal - prevVal;
      if (Math.abs(change) > 0.001) {
        diffs.push({
          signal_id: id,
          contribution: change,
          reason: cur?.reason ?? "signal removed or expired",
        });
      }
    }

    this.prevContributions.clear();
    for (const [k, v] of currentContributions.entries()) {
      this.prevContributions.set(k, v.c);
    }

    diffs.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
    const top = diffs.slice(0, 3);
    st.why = { t: st.t, delta, top };

    if (belief.rules_fired.length === 0 && Math.abs(delta) > 0.05 && top.length > 0) {
      belief.rules_fired.push(
        `Δ ${delta >= 0 ? "+" : ""}${delta.toFixed(2)} from ${top.map((x) => x.signal_id).join(", ")}`,
      );
    }

    st.belief = belief;
    st.decision = decision;
    st.predictions = foresee(st.events, st.t, pCrisisOf(belief), st.sources);
  }

  finish(): Memory {
    const truthCrisis = EPISODES[this.name].truth === "crisis";
    const hadRain = this.state.events.some((e) => e.type === "heavy_rain");
    return learn(
      this.memory ?? EMPTY_MEMORY,
      this.state.events,
      truthCrisis,
      this.maxActionReached,
      hadRain,
    );
  }

  /** Advance the virtual clock by dt seconds. */
  tick(dt: number) {
    const st = this.state;
    st.t = Math.min(this.duration, st.t + dt);
    const auto = EPISODES[this.name].autoCutout;

    while (
      this.cursor < this.script.length &&
      (this.script[this.cursor]!.arrival_t ?? this.script[this.cursor]!.t) <= st.t
    ) {
      this.ingest(this.script[this.cursor]!);
      this.cursor++;
    }

    if (auto && !this.autoCutoutDone && st.t >= auto.t) {
      this.autoCutoutDone = true;
      this.cutout(auto.sources);
      return this.snapshot();
    }

    this.recompute();
    return this.snapshot();
  }

  done() {
    return this.state.t >= this.duration;
  }

  snapshot(): EngineState {
    const snap = structuredClone(this.state);
    if (snap.events.length > 200) {
      snap.events = snap.events.slice(-200);
    }
    return snap;
  }
}

/** Replay an episode deterministically, returning a snapshot every `step` virtual seconds. */
export function replay(name: EpisodeName, step = 30, memory?: Memory): EngineState[] {
  const ep = new Episode(name, memory);
  const out: EngineState[] = [ep.snapshot()];
  let iterations = 0;
  while (!ep.done() && iterations < 500) {
    out.push(ep.tick(step));
    iterations++;
  }
  return out;
}

export function compare(a: EpisodeName, b: EpisodeName, step = 30, memory?: Memory) {
  const ra = replay(a, step, memory);
  const rb = replay(b, step, memory);
  const n = Math.max(ra.length, rb.length);
  return Array.from({ length: n }, (_, i) => {
    const x = ra[Math.min(i, ra.length - 1)]!;
    const y = rb[Math.min(i, rb.length - 1)]!;
    return {
      t: x.t,
      a: { cascade: x.belief.distribution.CASCADING_CRISIS, action: x.decision.action },
      b: { cascade: y.belief.distribution.CASCADING_CRISIS, action: y.decision.action },
      diverged: x.decision.action !== y.decision.action,
    };
  });
}

export const fmtT = (t: number) =>
  `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(Math.round(t % 60)).padStart(2, "0")}`;
