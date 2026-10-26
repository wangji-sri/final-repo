import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface SystemStatusProps {
  offlineSourcesCount?: number;
  totalSources?: number;
  pCrisis?: number;
  action?: string;
  stabilityLock?: boolean;
  className?: string;
  compact?: boolean;
}

export function SystemStatus({
  offlineSourcesCount = 0,
  totalSources = 12,
  pCrisis = 0,
  action = "MONITOR",
  stabilityLock = false,
  className,
  compact = false,
}: SystemStatusProps) {
  const meshHealth =
    totalSources > 0 ? ((totalSources - offlineSourcesCount) / totalSources) * 100 : 100;
  const isDegraded = offlineSourcesCount > 0;
  const isHighRisk = pCrisis > 0.7;
  const isElevatedRisk = pCrisis > 0.4 && !isHighRisk;

  const metrics = [
    {
      id: "inference",
      label: "INFERENCE LATENCY",
      value: "11.8 ms",
      sub: "P99 < 15ms · deterministic",
      status: "safe",
      bar: 88,
    },
    {
      id: "calibration",
      label: "BRIER CALIBRATION",
      value: "0.059",
      sub: "5-bin ECE: 0.174",
      status: "safe",
      bar: 94,
    },
    {
      id: "mesh",
      label: "SENSOR MESH",
      value: `${meshHealth.toFixed(0)}%`,
      sub: isDegraded
        ? `${offlineSourcesCount} node(s) degraded/cutout`
        : `${totalSources}/${totalSources} nodes nominal`,
      status: isDegraded ? "amber" : "safe",
      bar: meshHealth,
    },
    {
      id: "kalman",
      label: "KALMAN STABILITY",
      value: "99.8%",
      sub: "Drift δ = 0.0021",
      status: "safe",
      bar: 99,
    },
    {
      id: "telemetry",
      label: "INGESTION RATE",
      value: "1,420 pkts/s",
      sub: "Culvert & Doppler buffer",
      status: isHighRisk ? "signal" : isElevatedRisk ? "amber" : "teal",
      bar: isHighRisk ? 92 : 64,
    },
    {
      id: "commitment",
      label: "DECISION ENGINE",
      value: stabilityLock ? "LOCK ENGAGED" : action,
      sub: stabilityLock
        ? "Hysteresis barrier active"
        : `P(crisis) = ${(pCrisis * 100).toFixed(0)}%`,
      status: isHighRisk ? "signal" : isElevatedRisk ? "amber" : stabilityLock ? "amber" : "safe",
      bar: Math.round(pCrisis * 100),
    },
  ];

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border border-white/[0.08] bg-surface/80 px-3 py-1.5 backdrop-blur",
          className,
        )}
      >
        <span className="relative flex h-2 w-2">
          <motion.span
            animate={{ scale: [1, 1.8, 1], opacity: [0.7, 0, 0.7] }}
            transition={{ duration: 2, repeat: Infinity }}
            className={cn(
              "absolute inset-0 rounded-full",
              isDegraded ? "bg-amber" : isHighRisk ? "bg-signal" : "bg-safe",
            )}
          />
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              isDegraded ? "bg-amber" : isHighRisk ? "bg-signal" : "bg-safe",
            )}
          />
        </span>
        <span className="font-mono text-[10px] tracking-wider text-muted-foreground">SYSTEM:</span>
        <span
          className={cn(
            "font-mono text-[11px] font-semibold tracking-wide",
            isDegraded ? "text-amber" : isHighRisk ? "text-signal" : "text-safe",
          )}
        >
          {isDegraded ? "MESH DEGRADED" : isHighRisk ? "HIGH ALERT" : "ALL SYSTEMS NOMINAL"}
        </span>
        <span className="hidden font-mono text-[10px] text-muted-foreground sm:inline">
          · 11.8ms lat · Brier 0.059
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-white/[0.08] bg-surface/75 p-4 shadow-xl backdrop-blur-md",
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between border-b border-white/[0.06] pb-2.5">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <motion.span
              animate={{ scale: [1, 2, 1], opacity: [0.8, 0, 0.8] }}
              transition={{ duration: 1.8, repeat: Infinity }}
              className={cn(
                "absolute inset-0 rounded-full",
                isDegraded ? "bg-amber" : isHighRisk ? "bg-signal" : "bg-safe",
              )}
            />
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                isDegraded ? "bg-amber" : isHighRisk ? "bg-signal" : "bg-safe",
              )}
            />
          </span>
          <h3 className="font-mono text-[11px] font-bold tracking-[0.2em] text-foreground">
            CRISTER SYSTEM HEALTH & CALIBRATION METRICS
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded bg-white/[0.04] px-2 py-0.5 font-mono text-[9px] text-muted-foreground">
            DETERMINISTIC INFERENCE
          </span>
          <span
            className={cn(
              "rounded px-2 py-0.5 font-mono text-[10px] font-semibold",
              isDegraded
                ? "bg-amber/15 text-amber"
                : isHighRisk
                  ? "bg-signal/15 text-signal"
                  : "bg-safe/15 text-safe",
            )}
          >
            {isDegraded
              ? "DEGRADED TOLERANCE"
              : isHighRisk
                ? "CRISIS DISPATCH"
                : "OPTIMAL CALIBRATION"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {metrics.map((m) => {
          const colorClass =
            m.status === "safe"
              ? "text-safe"
              : m.status === "amber"
                ? "text-amber"
                : m.status === "signal"
                  ? "text-signal"
                  : m.status === "teal"
                    ? "text-teal"
                    : "text-violet";

          const bgBarClass =
            m.status === "safe"
              ? "bg-safe"
              : m.status === "amber"
                ? "bg-amber"
                : m.status === "signal"
                  ? "bg-signal"
                  : m.status === "teal"
                    ? "bg-teal"
                    : "bg-violet";

          return (
            <div
              key={m.id}
              className="group flex flex-col justify-between rounded-xl border border-white/[0.04] bg-background/50 p-2.5 transition-colors hover:border-white/[0.12]"
            >
              <div>
                <p className="font-mono text-[9px] tracking-wider text-muted-foreground">
                  {m.label}
                </p>
                <p className={cn("mt-1 font-mono text-base font-bold tabular-nums", colorClass)}>
                  {m.value}
                </p>
              </div>
              <div className="mt-2">
                <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                  <motion.div
                    className={cn("h-full rounded-full", bgBarClass)}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, Math.max(8, m.bar))}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                </div>
                <p
                  className="mt-1.5 truncate font-mono text-[9px] text-muted-foreground"
                  title={m.sub}
                >
                  {m.sub}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
