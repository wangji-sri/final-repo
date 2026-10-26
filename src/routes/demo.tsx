import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Episode, fmtT } from "@/engine/engine";
import { EPISODES, type EpisodeName } from "@/engine/fixtures";
import { zoneExposure, mostExposedZone } from "@/engine/causal-graph";
import { ACTIONS, type EngineState, type Memory } from "@/engine/types";
import { loadMemory, resetMemory, saveMemory, EMPTY_MEMORY } from "@/engine/learning";
import { compareBranches } from "@/lib/sentinel.functions";
import {
  ActionWord,
  CostPanel,
  HypothesisBars,
  PredictionList,
  SignalRow,
  SourceCard,
  Typewriter,
  ACTION_TEXT,
} from "@/components/sentinel/parts";
import { CityMap } from "@/components/sentinel/CityMap";
import { BranchVideoInjector } from "@/components/sentinel/BranchVideoInjector";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "CRISTER Live — Emergency operations dashboard" },
      {
        name: "description",
        content:
          "Play the crisis and false-alarm branches, inject cutouts and retract signals while the CRISTER engine recalibrates live.",
      },
      { property: "og:title", content: "CRISTER Live — Emergency operations dashboard" },
      {
        property: "og:description",
        content:
          "Watch the inference engine recompute beliefs, decisions and foresight in real time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Demo,
});

type CompareRow = Awaited<ReturnType<typeof compareBranches>>[number];

function Demo() {
  const [name, setName] = useState<EpisodeName>("branch_a");
  const memoryRef = useRef<Memory>(EMPTY_MEMORY);
  const ep = useRef<Episode | null>(null);
  if (!ep.current) {
    ep.current = new Episode("branch_a", memoryRef.current);
  }

  const [state, setState] = useState<EngineState>(() => ep.current!.snapshot());
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [displayMode, setDisplayMode] = useState<"video" | "map">("video");
  const [sourcesOpen, setSourcesOpen] = useState(true);
  const [cmp, setCmp] = useState<CompareRow[] | null>(null);
  const [cmpLoading, setCmpLoading] = useState(false);
  const [flash, setFlash] = useState(false);
  const prevCascade = useRef(0);
  const [memoryVersion, setMemoryVersion] = useState(0);

  // Load persistent memory on client mount
  useEffect(() => {
    const loaded = loadMemory();
    memoryRef.current = loaded;
    if (ep.current) {
      ep.current = new Episode(name, loaded);
      setState(ep.current.snapshot());
      setMemoryVersion((v) => v + 1);
    }
  }, []);

  const reset = useCallback((n: EpisodeName) => {
    ep.current = new Episode(n, memoryRef.current);
    setName(n);
    setPlaying(false);
    prevCascade.current = 0;
    setState(ep.current.snapshot());
  }, []);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      if (!ep.current) return;
      const s = ep.current.tick(2);
      setState(s);
      if (ep.current.done()) {
        setPlaying(false);
        const m = ep.current.finish();
        memoryRef.current = m;
        saveMemory(m);
        setMemoryVersion((v) => v + 1);
      }
    }, 200 / speed);
    return () => clearInterval(id);
  }, [playing, speed]);

  useEffect(() => {
    const c = state.belief.distribution.CASCADING_CRISIS ?? 0;
    let tid: ReturnType<typeof setTimeout> | undefined;
    if (c - prevCascade.current > 0.12) {
      setFlash(true);
      tid = setTimeout(() => setFlash(false), 700);
    }
    prevCascade.current = c;
    return () => {
      if (tid) clearTimeout(tid);
    };
  }, [state.belief]);

  const exposure = useMemo(
    () => zoneExposure(state.events, state.t),
    [state.t, state.events.length],
  );
  const focus = useMemo(
    () => mostExposedZone(state.events, state.t),
    [state.t, state.events.length],
  );
  const offline = state.sources.filter((s) => s.status === "offline");
  const a = state.decision.action;
  const lastDecision = [...state.log].reverse().find((l) => l.kind !== "info");

  const priorShifted =
    Math.abs(state.prior.crisisOdds - 1) / 1 > 0.25 ||
    Math.abs(state.prior.rainNormality - 0.5) / 0.5 > 0.25;

  const openCompare = async () => {
    setCmpLoading(true);
    try {
      setCmp(await compareBranches({ data: { a: "branch_a", b: "branch_b" } }));
    } finally {
      setCmpLoading(false);
    }
  };

  const handleResetMemory = () => {
    resetMemory();
    memoryRef.current = { ...EMPTY_MEMORY, trust: {} };
    if (ep.current) {
      ep.current = new Episode(name, memoryRef.current);
      setState(ep.current.snapshot());
      setMemoryVersion((v) => v + 1);
    }
  };

  const handleSimulate5Days = () => {
    const sequence: EpisodeName[] = [
      "branch_b",
      "messy_stream",
      "branch_b",
      "messy_stream",
      "branch_a",
    ];
    let currentMem = { ...memoryRef.current };
    for (const epName of sequence) {
      const runner = new Episode(epName, currentMem);
      let iter = 0;
      while (!runner.done() && iter < 100) {
        runner.tick(30);
        iter++;
      }
      currentMem = runner.finish();
      saveMemory(currentMem);
    }
    memoryRef.current = currentMem;
    setMemoryVersion((v) => v + 1);
    reset(name);
  };

  const safePCrisis = Number.isFinite(state.decision.p_crisis) ? state.decision.p_crisis : 0;
  const safeRaw = Number.isFinite(state.belief.raw_score) ? state.belief.raw_score : 0;

  return (
    <main id="main" className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur">
        <Link to="/" className="font-display text-2xl tracking-wide">
          CRISTER
        </Link>
        <span className="font-mono text-[10px] tracking-widest text-muted-foreground">
          LIVE · EOC
        </span>
        {priorShifted && (
          <span
            title={`Prior shift: crisis odds ${state.prior.crisisOdds.toFixed(2)}, rain normality ${state.prior.rainNormality.toFixed(2)}, false alarms ${state.prior.falseAlarms.toFixed(1)}`}
            className="rounded border border-amber bg-amber/15 px-2 py-0.5 font-mono text-[10px] text-amber cursor-help"
          >
            PRIOR SHIFTED ({state.prior.crisisOdds.toFixed(2)}x)
          </span>
        )}
        <div
          className="mx-2 flex rounded-md border border-border p-0.5"
          role="tablist"
          aria-label="Episode"
        >
          {(Object.keys(EPISODES) as EpisodeName[]).map((n) => (
            <button
              key={n}
              role="tab"
              aria-selected={n === name}
              onClick={() => reset(n)}
              className={cn(
                "rounded px-3 py-1.5 text-xs",
                n === name
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {EPISODES[n].label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Btn
            primary
            onClick={() =>
              ep.current?.done()
                ? (reset(name), setTimeout(() => setPlaying(true), 0))
                : setPlaying((p) => !p)
            }
          >
            {playing ? "Pause" : "Play"}
          </Btn>
          {[1, 2, 4].map((s) => (
            <Btn key={s} active={speed === s} onClick={() => setSpeed(s)}>
              {s}×
            </Btn>
          ))}
          <Btn onClick={() => reset(name)}>Reset</Btn>
        </div>
        <div className="flex items-center gap-1">
          {offline.length > 0 ? (
            <Btn
              onClick={() => {
                ep.current?.restore();
                if (ep.current) setState(ep.current.snapshot());
              }}
            >
              Restore sources
            </Btn>
          ) : (
            <Btn
              onClick={() => {
                ep.current?.cutout();
                if (ep.current) setState(ep.current.snapshot());
              }}
            >
              Inject cutout
            </Btn>
          )}
          <Btn
            onClick={() => {
              ep.current?.retractLastDrainage();
              if (ep.current) setState(ep.current.snapshot());
            }}
            disabled={!state.events.some((e) => e.type === "drainage_anomaly" && !e.retracted)}
          >
            Retract last drainage
          </Btn>
          <Btn onClick={openCompare}>{cmpLoading ? "Comparing…" : "Compare branches"}</Btn>
          <Btn onClick={handleSimulate5Days}>Simulate 5 days</Btn>
          <Btn onClick={handleResetMemory}>Reset learning</Btn>
        </div>
        <div
          className="ml-auto font-mono text-2xl tabular-nums text-amber"
          aria-label="Virtual clock"
        >
          T+{fmtT(Number.isFinite(state.t) ? state.t : 0)}
        </div>
      </header>

      <AnimatePresence>
        {offline.length > 0 && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden bg-amber/15 text-center font-mono text-xs text-amber"
          >
            <p className="py-2">
              {offline.length} sources offline — belief widened, action held 120 s
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid gap-4 p-4 xl:grid-cols-[320px_1fr_1.1fr]">
        <section
          aria-label="Live signal feed"
          className="glass flex max-h-[calc(100vh-180px)] flex-col rounded-xl p-4"
        >
          <h2 className="mb-2 font-mono text-[11px] tracking-[0.2em] text-muted-foreground">
            SIGNAL FEED · {state.events.length}
          </h2>
          <ul className="flex-1 overflow-y-auto pr-1">
            {[...state.events]
              .reverse()
              .slice(0, 50)
              .map((e) => (
                <SignalRow key={e.id} e={e} sources={state.sources} />
              ))}
            {state.events.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Press Play to start the virtual clock.
              </p>
            )}
          </ul>
        </section>

        <div className="flex flex-col gap-4">
          <section
            aria-label="Hypotheses"
            className={cn(
              "glass rounded-xl p-5 transition-shadow",
              flash && "shadow-[0_0_0_2px_var(--signal)]",
            )}
          >
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground">
                HYPOTHESES
              </h2>
              <span className="font-mono text-[11px] text-muted-foreground">
                evidence score {safeRaw.toFixed(2)} · P(crisis) {(safePCrisis * 100).toFixed(0)}%
              </span>
            </div>
            <HypothesisBars distribution={state.belief.distribution} />
            {state.belief.rules_fired.length > 0 && (
              <ul className="mt-4 space-y-1 font-mono text-[10px] text-muted-foreground">
                {state.belief.rules_fired.map((r, i) => (
                  <li key={`${r}-${i}`}>› {r}</li>
                ))}
              </ul>
            )}

            {/* Why it changed panel */}
            <div className="mt-4 border-t border-border pt-3">
              <p className="font-mono text-[10px] tracking-widest text-muted-foreground">
                WHY IT CHANGED {state.why?.delta ? `· Δ ${state.why.delta.toFixed(2)}` : ""}
              </p>
              {state.why && state.why.top.length > 0 ? (
                <ul className="mt-1 space-y-1 font-mono text-[10px]">
                  {state.why.top.map((c, i) => (
                    <li key={i} className="flex justify-between text-muted-foreground">
                      <span className="truncate pr-2">
                        {c.signal_id} ({c.reason})
                      </span>
                      <span
                        className={cn(
                          "tabular-nums font-semibold",
                          c.contribution > 0 ? "text-amber" : "text-teal",
                        )}
                      >
                        {c.contribution > 0 ? "+" : ""}
                        {c.contribution.toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                  Baseline steady state.
                </p>
              )}
            </div>
          </section>

          <section aria-label="Recommended action" className="glass rounded-xl p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground">
                RECOMMENDED ACTION
              </h2>
              {state.decision.stability_lock && (
                <span
                  title="Hysteresis is holding the current action until evidence clears the margin."
                  className="rounded-full border border-amber px-2 py-0.5 font-mono text-[10px] text-amber"
                >
                  STABILITY LOCK
                </span>
              )}
            </div>
            <div className="my-3">
              <ActionWord action={a} />
            </div>
            <div className="mb-3 flex gap-1">
              {ACTIONS.map((x, i) => (
                <div
                  key={x}
                  className={cn(
                    "h-1 flex-1 rounded",
                    i <= ACTIONS.indexOf(a) ? "bg-current" : "bg-muted",
                    ACTION_TEXT[a],
                  )}
                />
              ))}
            </div>
            <div className="rounded-lg bg-muted/60 p-3">
              <p className="mb-1 font-mono text-[10px] tracking-widest text-muted-foreground">
                REASON FOR CHANGE{" "}
                {lastDecision &&
                  `· T+${fmtT(Number.isFinite(lastDecision.t) ? lastDecision.t : 0)}`}
              </p>
              <Typewriter
                key={lastDecision?.text ?? state.decision.reason}
                text={lastDecision?.text ?? state.decision.reason}
                className="min-h-[3em] text-sm"
              />
              <p className="mt-2 text-xs text-muted-foreground">Now: {state.decision.reason}</p>
            </div>
            <div className="mt-4">
              <p className="mb-2 font-mono text-[10px] tracking-widest text-muted-foreground">
                EXPECTED COST · P(crisis) {(safePCrisis * 100).toFixed(0)}%
              </p>
              <CostPanel
                costs={state.decision.expected_cost_per_action}
                action={a}
                argmin={state.decision.argmin_action}
              />
            </div>
          </section>
        </div>

        <section
          aria-label="Tactical surveillance and spatial map"
          className="flex flex-col h-[560px] xl:h-auto xl:min-h-[640px]"
        >
          {/* Header Switch between Live Tactical Video Feed and Spatial Vector Map */}
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground">
              {displayMode === "video" ? "SURVEILLANCE STREAM · SYNCHRONIZED" : "SPATIAL TOPOLOGY"}
            </span>
            <div className="flex rounded-lg border border-border bg-card/60 p-0.5 font-mono text-[10px]">
              <button
                onClick={() => setDisplayMode("video")}
                className={cn(
                  "flex items-center gap-1.5 rounded px-2.5 py-1 transition-colors",
                  displayMode === "video"
                    ? "bg-amber text-primary-foreground font-bold shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                📹 Tactical Video Feed
              </button>
              <button
                onClick={() => setDisplayMode("map")}
                className={cn(
                  "flex items-center gap-1.5 rounded px-2.5 py-1 transition-colors",
                  displayMode === "map"
                    ? "bg-secondary text-foreground font-bold shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                🗺️ Vector Map
              </button>
            </div>
          </div>

          <div className="relative flex-1 overflow-hidden rounded-2xl border border-white/[0.08] shadow-2xl">
            {displayMode === "video" ? (
              <BranchVideoInjector
                branch={name}
                t={Number.isFinite(state.t) ? state.t : 0}
                action={a}
                pCrisis={safePCrisis}
                isPlaying={playing}
                speed={speed}
                showEvacuationGuide={true}
                onTogglePlay={() => setPlaying((p) => !p)}
                className="h-full w-full"
              />
            ) : (
              <Suspense fallback={<div className="h-full animate-pulse rounded-xl bg-muted" />}>
                <CityMap
                  exposure={exposure}
                  pCrisis={safePCrisis}
                  showRoute={ACTIONS.indexOf(a) >= 1}
                  focus={focus}
                  degraded={offline.length > 0}
                />
              </Suspense>
            )}
          </div>
        </section>
      </div>

      <section aria-label="Causal timeline" className="px-4 pb-4">
        <h2 className="mb-2 font-mono text-[11px] tracking-[0.2em] text-muted-foreground">
          CAUSAL TIMELINE · NEXT THREE
        </h2>
        <PredictionList
          predictions={state.predictions}
          t={Number.isFinite(state.t) ? state.t : 0}
        />
      </section>

      <section aria-label="Source reliability" className="px-4 pb-10">
        <button
          onClick={() => setSourcesOpen((o) => !o)}
          className="mb-2 font-mono text-[11px] tracking-[0.2em] text-muted-foreground hover:text-foreground"
        >
          SOURCE RELIABILITY {sourcesOpen ? "▾" : "▸"}
        </button>
        {sourcesOpen && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {state.sources.map((s) => (
              <SourceCard key={s.id} s={s} />
            ))}
          </div>
        )}
      </section>

      <AnimatePresence>
        {cmp && (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setCmp(null)}
          >
            <motion.div
              role="dialog"
              aria-label="Twin test"
              className="glass max-h-[85vh] w-full max-w-3xl overflow-auto rounded-2xl p-6"
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-3xl">The Twin Test</h2>
                <Btn onClick={() => setCmp(null)}>Close</Btn>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                Identical prefixes. Divergent truths. Computed on the server, tick by tick.
              </p>
              <table className="w-full font-mono text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="py-1 text-left">T</th>
                    <th className="text-left">A · cascade</th>
                    <th className="text-left">A · action</th>
                    <th className="text-left">B · cascade</th>
                    <th className="text-left">B · action</th>
                  </tr>
                </thead>
                <tbody>
                  {cmp.map((r) => (
                    <tr
                      key={r.t}
                      className={cn("border-t border-border", r.diverged && "bg-amber/10")}
                    >
                      <td className="py-1">{fmtT(Number.isFinite(r.t) ? r.t : 0)}</td>
                      <td>
                        <Bar v={Number.isFinite(r.a.cascade) ? r.a.cascade : 0} cls="bg-signal" />
                      </td>
                      <td className={ACTION_TEXT[r.a.action]}>{r.a.action}</td>
                      <td>
                        <Bar v={Number.isFinite(r.b.cascade) ? r.b.cascade : 0} cls="bg-teal" />
                      </td>
                      <td className={ACTION_TEXT[r.b.action]}>{r.b.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function Bar({ v, cls }: { v: number; cls: string }) {
  const safeV = Number.isFinite(v) ? v : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 rounded bg-muted">
        <div className={cn("h-full rounded", cls)} style={{ width: `${safeV * 100}%` }} />
      </div>
      {(safeV * 100).toFixed(0)}%
    </div>
  );
}

function Btn({
  children,
  onClick,
  primary,
  active,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-md border px-3 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40",
        primary
          ? "border-amber bg-amber text-primary-foreground hover:bg-amber/90"
          : active
            ? "border-amber text-amber"
            : "border-border text-foreground hover:bg-secondary",
      )}
    >
      {children}
    </button>
  );
}
