import { ACTIONS, type Action, type IngestedEvent, type Memory, type Prior } from "./types";
import { SOURCE_DEFS } from "./fixtures";
import { TYPE_WEIGHT } from "./rules";

export const EMPTY_MEMORY: Memory = {
  trust: {},
  crisisRate: 0.15,
  rainRate: 0.3,
  falseAlarms: 0,
  episodes: 0,
};

export const KEY = "sentinel-memory-v1";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function loadMemory(): Memory {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Memory;
        return {
          trust: { ...parsed.trust },
          crisisRate: parsed.crisisRate ?? 0.15,
          rainRate: parsed.rainRate ?? 0.3,
          falseAlarms: parsed.falseAlarms ?? 0,
          episodes: parsed.episodes ?? 0,
        };
      }
    }
  } catch {
    // Ignore storage errors
  }
  return { ...EMPTY_MEMORY, trust: {} };
}

export function saveMemory(m: Memory): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(KEY, JSON.stringify(m));
    }
  } catch {
    // Ignore storage errors
  }
}

export function resetMemory(): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export function priorFrom(m: Memory): Prior {
  const odds = m.crisisRate / (1 - m.crisisRate) / (0.15 / 0.85);
  return {
    crisisOdds: clamp(odds, 0.5, 2.5),
    rainNormality: clamp(m.rainRate, 0, 1),
    falseAlarms: m.falseAlarms,
  };
}

export function learn(
  m: Memory,
  events: IngestedEvent[],
  truthCrisis: boolean,
  maxAction: Action,
  hadRain: boolean,
): Memory {
  const trust: Record<string, { a: number; b: number }> = {};

  for (const s of SOURCE_DEFS) {
    const prev = m.trust[s.id];
    let a = prev ? prev.a : s.base_reliability * 8;
    let b = prev ? prev.b : (1 - s.base_reliability) * 8;

    const sourcePosEvents = events.filter(
      (e) => e.source === s.id && (TYPE_WEIGHT[e.type] ?? 0) > 0,
    );
    for (const e of sourcePosEvents) {
      if (e.retracted) {
        b += 1;
      } else if (truthCrisis) {
        a += 1;
      }
    }

    if (a + b > 40) {
      a *= 0.9;
      b *= 0.9;
    }
    trust[s.id] = { a, b };
  }

  const crisisRate = clamp(0.8 * m.crisisRate + 0.2 * (truthCrisis ? 1 : 0), 0.02, 0.98);
  const rainRate = 0.8 * m.rainRate + 0.2 * (hadRain ? 1 : 0);
  const actionIdx = ACTIONS.indexOf(maxAction);
  const falseAlarms = 0.7 * m.falseAlarms + (!truthCrisis && actionIdx >= 2 ? 1 : 0);

  return {
    trust,
    crisisRate,
    rainRate,
    falseAlarms,
    episodes: m.episodes + 1,
  };
}
