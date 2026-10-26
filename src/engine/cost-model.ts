/** Layer 3a — cost-aware decision with hysteresis (stability lock). */
import { ACTIONS, type Action, type Belief, type Decision } from "./types";

export const FALSE_ALARM_COST: Record<Action, number> = {
  WATCH: 0,
  PREPARE: 0.2,
  ALERT: 0.5,
  ESCALATE: 1.0,
};

export const DAMAGE_COST: Record<Action, number> = {
  WATCH: 1.0,
  PREPARE: 0.7,
  ALERT: 0.4,
  ESCALATE: 0.15,
};

export const UP_MARGIN = 0.06;
export const DOWN_GAP = 0.03;
export const SKIP_GAP = 0.15;
export const MIN_DWELL_DOWN_S = 120;
export const LEAD_GAIN = 0.06;
export const LEAD_CAP_MIN = 5;
export const FATIGUE_GAIN = 0.25;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** P(crisis) used by the cost model: full cascade mass plus half of an isolated incident. */
export const pCrisisOf = (b: Belief) =>
  b.distribution.CASCADING_CRISIS + 0.5 * b.distribution.ISOLATED_INCIDENT;

export function expectedCosts(p: number, minutes = 0, falseAlarms = 0): Record<Action, number> {
  const m = clamp(minutes, 0, LEAD_CAP_MIN);
  const f = 1 + FATIGUE_GAIN * Math.min(falseAlarms, 4);
  const out = {} as Record<Action, number>;

  for (const a of ACTIONS) {
    const fa = a === "ALERT" || a === "ESCALATE" ? FALSE_ALARM_COST[a] * f : FALSE_ALARM_COST[a];
    const dm = DAMAGE_COST[a] + LEAD_GAIN * m * (DAMAGE_COST[a] - DAMAGE_COST.ESCALATE);
    out[a] = (1 - p) * fa + p * dm;
  }
  return out;
}

export function decide(
  belief: Belief,
  prev: Action | null,
  ctx: { minutes: number; falseAlarms: number; sinceChangeS: number } = {
    minutes: 0,
    falseAlarms: 0,
    sinceChangeS: Infinity,
  },
): Decision {
  const p = pCrisisOf(belief);
  const costs = expectedCosts(p, ctx.minutes, ctx.falseAlarms);
  const argmin = ACTIONS.reduce(
    (best, a) => (costs[a] < costs[best] ? a : best),
    "WATCH" as Action,
  );
  const cur = prev ?? "WATCH";
  const ci = ACTIONS.indexOf(cur);
  const ai = ACTIONS.indexOf(argmin);
  let action = cur;
  let lock = false;
  let reason: string;

  const extraMeta = [
    ctx.minutes > 0 ? `lead=${ctx.minutes.toFixed(1)}m` : null,
    ctx.falseAlarms > 0 ? `fatigue=${ctx.falseAlarms.toFixed(1)}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  const metaSuffix = extraMeta ? ` [${extraMeta}]` : "";

  if (ai > ci) {
    const next = costs[cur] - costs[argmin] > SKIP_GAP ? argmin : ACTIONS[ci + 1]!;
    if (costs[next] < costs[cur] - UP_MARGIN) {
      action = next;
      reason = `P(crisis) ${(p * 100).toFixed(0)}% → ${next} now cheaper than ${cur} by ${(costs[cur] - costs[next]).toFixed(2)}${metaSuffix}.`;
    } else {
      lock = true;
      reason = `${argmin} marginally cheaper, but within the ${UP_MARGIN} up-margin — holding ${cur}${metaSuffix}.`;
    }
  } else if (ai < ci) {
    const gap = costs[cur] - costs[argmin];
    if (gap > SKIP_GAP) {
      action = argmin;
      reason = `P(crisis) fell to ${(p * 100).toFixed(0)}% — cost gap ${gap.toFixed(2)} exceeds skip threshold; stepping down ${cur} → ${argmin}${metaSuffix}.`;
    } else if (gap > DOWN_GAP && ctx.sinceChangeS >= MIN_DWELL_DOWN_S) {
      const stepDown = ACTIONS[ci - 1]!;
      action = stepDown;
      reason = `P(crisis) fell to ${(p * 100).toFixed(0)}% — stepping down ${cur} → ${stepDown}; holding ${cur} costs ${(costs[cur] - costs[stepDown]).toFixed(2)} more${metaSuffix}.`;
    } else {
      lock = true;
      reason =
        ctx.sinceChangeS < MIN_DWELL_DOWN_S
          ? `Evidence softened, but dwelling for stability (${Math.round(ctx.sinceChangeS)}s < ${MIN_DWELL_DOWN_S}s) — holding ${cur}${metaSuffix}.`
          : `Evidence softened, but gap within down margin — stability lock holds ${cur}${metaSuffix}.`;
    }
  } else {
    reason = `${cur} remains the minimum expected-cost action at P(crisis) ${(p * 100).toFixed(0)}%${metaSuffix}.`;
  }

  return {
    t: belief.t,
    action,
    argmin_action: argmin,
    expected_cost_per_action: costs,
    p_crisis: p,
    reason,
    stability_lock: lock,
    previous_action: prev,
  };
}
