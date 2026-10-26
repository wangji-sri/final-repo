import { AnimatePresence, motion, useSpring, useTransform } from "framer-motion";
import React, { memo, useEffect, useState } from "react";
import {
  ACTIONS,
  HYPOTHESES,
  HYPOTHESIS_LABEL,
  type Action,
  type Hypothesis,
  type IngestedEvent,
  type PredictedEvent,
  type Source,
} from "@/engine/types";
import { fmtT } from "@/engine/engine";
import { cn } from "@/lib/utils";

export const ACTION_TEXT: Record<Action, string> = {
  WATCH: "text-teal",
  PREPARE: "text-amber",
  ALERT: "text-signal",
  ESCALATE: "text-violet",
};
export const ACTION_BG: Record<Action, string> = {
  WATCH: "bg-teal",
  PREPARE: "bg-amber",
  ALERT: "bg-signal",
  ESCALATE: "bg-violet",
};
const HYP_BG: Record<Hypothesis, string> = {
  NOISE: "bg-muted-foreground",
  SENSOR_FAILURE: "bg-violet",
  ISOLATED_INCIDENT: "bg-amber",
  CASCADING_CRISIS: "bg-signal",
};

export function Counter({
  value,
  digits = 0,
  suffix = "",
}: {
  value: number;
  digits?: number;
  suffix?: string;
}) {
  const safeVal = Number.isFinite(value) ? value : 0;
  const spring = useSpring(safeVal, { stiffness: 120, damping: 22 });
  const text = useTransform(spring, (v) => v.toFixed(digits) + suffix);
  useEffect(() => spring.set(safeVal), [safeVal, spring]);
  return <motion.span>{text}</motion.span>;
}

export function relClass(r: number) {
  const safeR = Number.isFinite(r) ? r : 0;
  return safeR >= 0.8 ? "bg-teal" : safeR >= 0.6 ? "bg-amber" : "bg-signal";
}

export function HypothesisBars({
  distribution,
  compact,
}: {
  distribution: Record<Hypothesis, number>;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col", compact ? "gap-2" : "gap-4")}>
      {HYPOTHESES.map((h) => {
        const rawV = distribution[h] ?? 0;
        const v = Number.isFinite(rawV) ? rawV : 0;
        return (
          <div key={h}>
            <div className="mb-1 flex items-baseline justify-between text-xs">
              <span className="uppercase tracking-[0.18em] text-muted-foreground">
                {HYPOTHESIS_LABEL[h]}
              </span>
              <span
                className={cn(
                  "font-mono tabular-nums",
                  h === "CASCADING_CRISIS" && v > 0.5 ? "text-signal" : "text-foreground",
                )}
              >
                <Counter value={v * 100} suffix="%" />
              </span>
            </div>
            <div
              className={cn("overflow-hidden rounded-full bg-muted", compact ? "h-1.5" : "h-2.5")}
            >
              <motion.div
                className={cn("h-full rounded-full", HYP_BG[h])}
                animate={{ width: `${Math.max(1, v * 100)}%` }}
                transition={{ type: "spring", stiffness: 90, damping: 20 }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ActionWord({ action, size = "lg" }: { action: Action; size?: "lg" | "xl" }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden",
        size === "xl" ? "h-[1.1em] text-7xl md:text-9xl" : "h-[1.1em] text-5xl md:text-6xl",
      )}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={action}
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "-100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 160, damping: 22 }}
          className={cn("font-display leading-none tracking-tight", ACTION_TEXT[action])}
        >
          {action}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export function CostPanel({
  costs,
  action,
  argmin,
}: {
  costs: Record<Action, number>;
  action: Action;
  argmin?: Action;
}) {
  const max = Math.max(...Object.values(costs).map((v) => (Number.isFinite(v) ? v : 0)), 0.01);
  return (
    <div className="space-y-2">
      {ACTIONS.map((a) => {
        const val = Number.isFinite(costs[a]) ? costs[a] : 0;
        return (
          <div key={a} className="flex items-center gap-3 text-xs">
            <span
              className={cn(
                "w-20 font-mono",
                a === action ? ACTION_TEXT[a] : "text-muted-foreground",
              )}
            >
              {a}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <motion.div
                layout
                className={cn(
                  "h-full rounded-full",
                  a === action ? ACTION_BG[a] : "bg-muted-foreground/40",
                )}
                animate={{ width: `${(val / max) * 100}%` }}
                transition={{ type: "spring", stiffness: 90, damping: 20 }}
              />
            </div>
            <span className="w-10 text-right font-mono tabular-nums text-muted-foreground">
              {val.toFixed(2)}
            </span>
            {argmin === a && a !== action ? (
              <span className="font-mono text-[10px] text-amber">min</span>
            ) : (
              <span className="w-[18px]" />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function Typewriter({ text, className }: { text: string; className?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const id = setInterval(
      () => setN((v) => (v >= text.length ? (clearInterval(id), v) : v + 2)),
      14,
    );
    return () => clearInterval(id);
  }, [text]);
  return (
    <p className={className}>
      {text.slice(0, n)}
      {n < text.length && (
        <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-amber align-middle" />
      )}
    </p>
  );
}

export const SignalRow = memo(function SignalRow({
  e,
  sources,
}: {
  e: IngestedEvent;
  sources?: Source[];
}) {
  const s = sources?.find((x) => x.id === e.source);
  const r = Number.isFinite(e.reliability_at_ingest) ? e.reliability_at_ingest : 0;
  return (
    <motion.li
      layout
      initial={{ opacity: 0, x: -16, clipPath: "inset(0 100% 0 0)" }}
      animate={{
        opacity: e.retracted || e.offline ? 0.45 : r < 0.6 ? 0.7 : 1,
        x: 0,
        clipPath: "inset(0 0% 0 0)",
      }}
      transition={{ duration: 0.45 }}
      className="border-b border-border py-2.5"
    >
      <div className="flex items-center gap-2 text-[11px]">
        <span className="font-mono text-muted-foreground">{fmtT(e.t)}</span>
        <span
          className={cn("rounded px-1.5 py-0.5 font-mono uppercase text-background", relClass(r))}
        >
          {s?.name ?? e.source}
        </span>
        {e.retracted && (
          <span className="rounded border border-signal px-1 font-mono text-[10px] text-signal">
            RETRACTED
          </span>
        )}
        {e.offline && (
          <span className="rounded border border-muted-foreground px-1 font-mono text-[10px] text-muted-foreground">
            OFFLINE
          </span>
        )}
      </div>
      <p className={cn("mt-1 text-sm", e.retracted && "line-through decoration-signal")}>
        {e.text}
      </p>
      <div className="mt-1.5 h-0.5 w-full overflow-hidden rounded bg-muted">
        <motion.div
          className={cn("h-full", relClass(r))}
          initial={{ width: 0 }}
          animate={{ width: `${r * 100}%` }}
          transition={{ duration: 0.8 }}
        />
      </div>
    </motion.li>
  );
});

export function Ring({ value, size = 56 }: { value: number; size?: number }) {
  const safeVal = Number.isFinite(value) ? value : 0;
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  const color = safeVal >= 0.8 ? "var(--teal)" : safeVal >= 0.6 ? "var(--amber)" : "var(--signal)";
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--muted)" strokeWidth={4} fill="none" />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth={4}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={c}
        animate={{ strokeDashoffset: c * (1 - safeVal) }}
        transition={{ type: "spring", stiffness: 60, damping: 18 }}
      />
    </svg>
  );
}

export function Sparkline({
  values,
  w = 120,
  h = 28,
}: {
  values: number[];
  w?: number;
  h?: number;
}) {
  const safeValues = values.map((v) => (Number.isFinite(v) ? v : 0));
  if (safeValues.length < 2) safeValues.push(safeValues[0] ?? 0);
  const pts = safeValues
    .map((v, i) => `${(i / (safeValues.length - 1)) * w},${h - v * h}`)
    .join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke="var(--amber)" strokeWidth={1.5} />
    </svg>
  );
}

export const SourceCard = memo(function SourceCard({
  s,
  compact,
}: {
  s: Source;
  compact?: boolean;
}) {
  const off = s.status === "offline";
  const r = Number.isFinite(s.current_reliability) ? s.current_reliability : 0;
  return (
    <div
      className={cn(
        "glass rounded-xl p-4 transition-opacity",
        off && "opacity-60",
        compact ? "" : "min-w-[240px]",
      )}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <Ring value={r} size={compact ? 40 : 56} />
          <span className="absolute inset-0 grid place-items-center font-mono text-[10px]">
            {Math.round(r * 100)}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn("truncate text-sm font-medium", off && "line-through")}>{s.name}</p>
          <span
            className={cn(
              "mt-1 inline-block rounded-full px-2 py-0.5 font-mono text-[10px] uppercase",
              off ? "bg-signal/20 text-signal" : "bg-teal/15 text-teal",
            )}
          >
            {s.status}
          </span>
        </div>
      </div>
      {!compact && (
        <div className="mt-3">
          <Sparkline values={s.history.map((x) => x.reliability)} w={200} />
        </div>
      )}
    </div>
  );
});

export function PredictionList({ predictions, t }: { predictions: PredictedEvent[]; t: number }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {predictions.map((p, i) => {
        const active = t >= p.window_start;
        const conf = Number.isFinite(p.confidence) ? p.confidence : 0;
        return (
          <motion.div
            key={`${p.event_type}-${i}`}
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn("glass rounded-lg p-3", active && "border-amber")}
          >
            <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
              <span>NEXT +{i + 1}</span>
              <span>{Math.round(conf * 100)}% conf.</span>
            </div>
            <p className="mt-1 text-sm font-medium">{p.label}</p>
            <p className="font-mono text-[11px] text-amber">
              {fmtT(p.window_start)}–{fmtT(p.window_end)}
            </p>
            <p className="font-mono text-[10px] text-muted-foreground">@ {p.location}</p>
            {p.because && p.because.length > 0 && (
              <p className="mt-1 truncate font-mono text-[9px] text-muted-foreground">
                path: {p.because.join(" → ")}
              </p>
            )}
          </motion.div>
        );
      })}
      {predictions.length === 0 && (
        <p className="text-sm text-muted-foreground">No downstream events predicted.</p>
      )}
    </div>
  );
}
