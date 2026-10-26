import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Volume2,
  VolumeX,
  Maximize2,
  ShieldAlert,
  CheckCircle2,
  Navigation,
  AlertTriangle,
  Play,
  Pause,
} from "lucide-react";

export interface BranchVideoInjectorProps {
  branch: "A" | "B" | "branch_a" | "branch_b" | "cutout_demo" | "messy_stream" | string;
  t?: number; // Virtual engine time (0 to 480)
  progress?: number; // 0 to 1 for scroll-based timeline
  action?: string;
  pCrisis?: number;
  isPlaying?: boolean;
  speed?: number;
  showEvacuationGuide?: boolean;
  className?: string;
  onTogglePlay?: () => void;
}

export function BranchVideoInjector({
  branch,
  t = 0,
  progress,
  action,
  pCrisis = 0,
  isPlaying = false,
  speed = 1,
  showEvacuationGuide = true,
  className,
  onTogglePlay,
}: BranchVideoInjectorProps) {
  const isBranchA = branch === "A" || branch === "branch_a" || branch === "cutout_demo";
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [hudActive, setHudActive] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);

  // Asset video paths
  const videoSrc = isBranchA
    ? "/assets/aistudio/Flood_simulation_over_city_1080p_20261026024809_c9cc49da.mp4"
    : "/assets/aistudio/Weather_transition_video_of_Guwa__20261026030111_cdaa0f1d.mp4";

  // Branch A video length is ~7.5s; flood flowing surge occurs at t >= 4.5s
  // Branch B video length is ~9.0s; clouds parting and golden sunlight occurs at t >= 5.0s
  const isEscalated =
    action === "ESCALATE" ||
    (isBranchA && t >= 300) ||
    (isBranchA && progress !== undefined && progress >= 0.62);
  const isFalseAlarmRecalibrated =
    !isBranchA &&
    (action === "STAND_DOWN" ||
      action === "MONITOR" ||
      t >= 240 ||
      (progress !== undefined && progress >= 0.5));

  // Compute target video timestamp based on engine time or scroll progress
  const targetVideoTime = useMemo(() => {
    if (progress !== undefined) {
      if (isBranchA) {
        // Branch A: 0..0.6 -> 0..4.4s (rain build up). 0.6..1.0 -> 4.5..7.5s (flood flowing surge)
        if (progress < 0.6) {
          return (progress / 0.6) * 4.4;
        } else {
          return 4.5 + ((progress - 0.6) / 0.4) * 3.0;
        }
      } else {
        // Branch B: 0..0.48 -> 0..4.8s (stormy alarm). 0.48..1.0 -> 5.0..9.0s (clearing sunlit peace)
        if (progress < 0.48) {
          return (progress / 0.48) * 4.8;
        } else {
          return 5.0 + ((progress - 0.48) / 0.52) * 4.0;
        }
      }
    }

    // Timeline based on engine clock t (0 to 480 seconds)
    const normalizedT = Math.min(1, Math.max(0, t / 480));
    if (isBranchA) {
      if (t < 300 && action !== "ESCALATE") {
        return (t / 300) * 4.4;
      } else {
        const floodProgress = Math.min(1, (t - 300) / 180);
        return 4.5 + floodProgress * 3.0;
      }
    } else {
      if (t < 240) {
        return (t / 240) * 4.8;
      } else {
        const clearProgress = Math.min(1, (t - 240) / 240);
        return 5.0 + clearProgress * 4.0;
      }
    }
  }, [isBranchA, progress, t, action]);

  // Synchronize video element playback and seek
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.playbackRate = speed;

    if (isPlaying) {
      if (video.paused) {
        video.play().catch(() => {});
      }
      // If video drifts significantly from simulation time, re-sync smoothly
      if (Math.abs(video.currentTime - targetVideoTime) > 0.8) {
        video.currentTime = targetVideoTime;
      }
    } else {
      if (!video.paused) {
        video.pause();
      }
      // Scrub to exact timestamp
      if (Math.abs(video.currentTime - targetVideoTime) > 0.1) {
        video.currentTime = targetVideoTime;
      }
    }
  }, [isPlaying, targetVideoTime, speed]);

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !muted;
      setMuted(!muted);
    }
  }, [muted]);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-white/[0.1] bg-black shadow-2xl transition-all",
        isEscalated && "ring-1 ring-signal/50",
        isFalseAlarmRecalibrated && "ring-1 ring-teal/50",
        className,
      )}
    >
      {/* Real-time Video Stream */}
      <div className="relative h-full w-full flex-1 overflow-hidden bg-black">
        <video
          ref={videoRef}
          src={videoSrc}
          playsInline
          loop
          muted={muted}
          preload="auto"
          onLoadedMetadata={() => setVideoLoaded(true)}
          className="h-full w-full object-cover select-none"
        />

        {/* Scanlines and Vignette overlay for tactical control-room feel */}
        <div className="pointer-events-none absolute inset-0 bg-radial-[circle_at_center,transparent_40%,rgba(0,0,0,0.65)_100%]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-30" />

        {/* Top Telemetry Header Bar */}
        <div className="absolute left-0 right-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/90 via-black/40 to-transparent p-3 font-mono text-[10px]">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span
                className={cn(
                  "absolute inset-0 rounded-full animate-ping opacity-75",
                  isEscalated ? "bg-signal" : isFalseAlarmRecalibrated ? "bg-teal" : "bg-amber",
                )}
              />
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  isEscalated ? "bg-signal" : isFalseAlarmRecalibrated ? "bg-teal" : "bg-amber",
                )}
              />
            </span>
            <span className="font-bold tracking-widest text-white/90">
              {isBranchA
                ? "INJECTOR A · CRISIS ESCALATION FEED"
                : "INJECTOR B · CORROBORATION & CLEAR FEED"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden rounded bg-black/60 px-2 py-0.5 text-white/70 backdrop-blur sm:inline">
              GUWAHATI BASIN · 26.14°N 91.73°E
            </span>
            <span
              className={cn(
                "rounded px-2 py-0.5 font-bold tracking-wider",
                isEscalated
                  ? "bg-signal text-white animate-pulse"
                  : isFalseAlarmRecalibrated
                    ? "bg-teal/20 text-teal border border-teal/40"
                    : "bg-amber/20 text-amber border border-amber/40",
              )}
            >
              {isEscalated
                ? "FLOOD INUNDATION ACTIVE"
                : isFalseAlarmRecalibrated
                  ? "THREAT DISPERSED · ALL CLEAR"
                  : "MONITORING PRE-SURGE"}
            </span>
          </div>
        </div>

        {/* Tactical Crosshairs & Grid Overlays */}
        <div className="pointer-events-none absolute inset-x-4 top-1/2 flex -translate-y-1/2 justify-between opacity-30">
          <div className="h-4 w-4 border-l border-t border-white" />
          <div className="h-4 w-4 border-r border-t border-white" />
        </div>
        <div className="pointer-events-none absolute inset-x-4 bottom-16 flex justify-between opacity-30">
          <div className="h-4 w-4 border-l border-b border-white" />
          <div className="h-4 w-4 border-r border-b border-white" />
        </div>

        {/* Dynamic Telemetry Watermark & Frame Marker */}
        <div className="pointer-events-none absolute left-3 top-12 font-mono text-[9px] text-white/60">
          <p>STATION: CAM-04 (NORTH BANK TOWER)</p>
          <p>SENSOR MESH: {isBranchA ? "ANOMALOUS RAPID CREST" : "CORROBORATING RETRACTIONS"}</p>
          <p>FRAME SYNC: {targetVideoTime.toFixed(2)}s</p>
        </div>

        {/* Quick controls on hover */}
        <div className="absolute right-3 top-12 flex gap-1.5 z-20">
          {onTogglePlay && (
            <button
              onClick={onTogglePlay}
              title={isPlaying ? "Pause simulation feed" : "Play simulation feed"}
              className="rounded-lg border border-white/20 bg-black/60 p-1.5 text-white/80 backdrop-blur hover:bg-black/90 hover:text-white transition-colors"
            >
              {isPlaying ? (
                <Pause className="h-3.5 w-3.5 text-amber" />
              ) : (
                <Play className="h-3.5 w-3.5 text-safe" />
              )}
            </button>
          )}
          <button
            onClick={toggleMute}
            title={muted ? "Unmute audio" : "Mute audio"}
            className="rounded-lg border border-white/20 bg-black/60 p-1.5 text-white/80 backdrop-blur hover:bg-black/90 hover:text-white transition-colors"
          >
            {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => setHudActive(!hudActive)}
            title="Toggle HUD details"
            className={cn(
              "rounded-lg border border-white/20 bg-black/60 px-2 py-1 font-mono text-[9px] text-white/80 backdrop-blur transition-colors",
              hudActive && "border-amber/60 text-amber",
            )}
          >
            HUD
          </button>
        </div>

        {/* Center Flash Stamp upon escalation or all-clear */}
        <AnimatePresence>
          {isEscalated && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-x-0 bottom-24 flex justify-center"
            >
              <div className="rounded-xl border border-signal/80 bg-signal/25 px-4 py-2 font-mono text-xs font-bold text-signal backdrop-blur-md shadow-2xl flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-signal animate-bounce" />
                <span>ESCALATE CONFIRMED · FLOOD SURGE FLOWING THROUGH MAIN ARTERY</span>
              </div>
            </motion.div>
          )}

          {isFalseAlarmRecalibrated && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-x-0 bottom-24 flex justify-center"
            >
              <div className="rounded-xl border border-teal/80 bg-teal/20 px-4 py-2 font-mono text-xs font-bold text-teal backdrop-blur-md shadow-2xl flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-teal" />
                <span>
                  FALSE ALARM RETRACTED · SKY CLEARED · PREVENTED UNNECESSARY STANDDOWN COST
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Evacuation Protocol & Specific Incident Action Guidance (Always Visible Bottom Bar) */}
        {showEvacuationGuide && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/95 to-black/60 p-3.5 border-t border-white/[0.08] backdrop-blur-md">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <Navigation
                  className={cn("h-3.5 w-3.5", isEscalated ? "text-signal" : "text-safe")}
                />
                <span className="font-mono text-[10px] font-bold tracking-widest text-white/90">
                  {isEscalated
                    ? "EMERGENCY EVACUATION PROTOCOL · ACTIVE"
                    : isFalseAlarmRecalibrated
                      ? "SAFETY REPORT · RECALIBRATION COMPLETE"
                      : "CIVIC EVACUATION CONTINGENCY · STANDBY"}
                </span>
              </div>
              <span className="font-mono text-[9px] text-white/60">
                P(CRISIS) = {(pCrisis * 100).toFixed(0)}%
              </span>
            </div>

            {isBranchA ? (
              <div className="space-y-1.5 font-sans text-xs">
                {isEscalated ? (
                  <div className="rounded-lg bg-signal/15 border border-signal/40 p-2 text-white">
                    <p className="font-semibold text-signal flex items-center gap-1.5">
                      <ShieldAlert className="h-3.5 w-3.5" />
                      MANDATORY EVACUATION DISPATCH:
                    </p>
                    <p className="mt-1 text-white/90 leading-relaxed font-sans text-[11px]">
                      <strong>Where to evacuate:</strong> Displace immediately to{" "}
                      <em>Dr. Bhupen Hazarika Cricket Stadium (Elevated Sanctuary)</em> or{" "}
                      <em>Science Museum High Grounds</em>.
                    </p>
                    <p className="text-white/80 font-mono text-[10px] mt-1">
                      Clearance Corridor: Use <strong>NH-27 Elevated Bypass</strong>. AVOID Bharalu
                      Riverfront and Low-lying Embankment road.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg bg-white/[0.04] border border-white/[0.08] p-2 text-white/80">
                    <p className="text-[11px] leading-relaxed">
                      <strong>Pending Contingency:</strong> Telemetry indicates culvert saturation.
                      Emergency evacuation buses staged at Khanapara and Stadium Gate 2.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1.5 font-sans text-xs">
                {isFalseAlarmRecalibrated ? (
                  <div className="rounded-lg bg-teal/15 border border-teal/40 p-2 text-white">
                    <p className="font-semibold text-teal flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      CIVIL DISRUPTION PREVENTED:
                    </p>
                    <p className="mt-1 text-white/90 leading-relaxed font-sans text-[11px]">
                      <strong>Status:</strong> Cloud cell dissipated over Kamrup range. Sensor
                      gateway 7 anomaly confirmed false positive. <em>No evacuation required</em>.
                    </p>
                    <p className="text-teal/80 font-mono text-[10px] mt-1">
                      Normal transit schedules retained · City schools and business corridors remain
                      open.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg bg-white/[0.04] border border-white/[0.08] p-2 text-white/80">
                    <p className="text-[11px] leading-relaxed">
                      <strong>Evaluating Sensor Credibility:</strong> Rain telemetry present,
                      awaiting culvert camera corroboration before committing civil alerts.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
