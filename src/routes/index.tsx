import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ArrowRight, Shield, Activity, Layers, Compass, RotateCcw } from "lucide-react";
import { replay, fmtT } from "@/engine/engine";
import { zoneExposure } from "@/engine/causal-graph";
import { ACTIONS, type Action, type EngineState } from "@/engine/types";
import {
  ActionWord,
  CostPanel,
  HypothesisBars,
  SignalRow,
  SourceCard,
  Typewriter,
  ACTION_TEXT,
} from "@/components/sentinel/parts";
import { CityMap } from "@/components/sentinel/CityMap";
import { BranchVideoInjector } from "@/components/sentinel/BranchVideoInjector";
import { EarthScrollCanvas } from "@/components/sentinel/EarthScrollSequence";
import { cn } from "@/lib/utils";

const PointCity = lazy(() => import("@/components/sentinel/PointCity"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CRISTER — Autonomous Crisis Inference Engine" },
      {
        name: "description",
        content:
          "Real-time crisis inference over messy multi-source telemetry. Four calibrated hypotheses, cost-aware commitment, and spatial foresight.",
      },
      { property: "og:title", content: "CRISTER — Autonomous Crisis Inference Engine" },
      {
        property: "og:description",
        content: "Honest inference. Cost-aware commitment. Spatial foresight.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Story,
});

const A = replay("branch_a", 30);
const B = replay("branch_b", 30);
const at = (arr: EngineState[], p: number) =>
  arr[Math.min(arr.length - 1, Math.max(0, Math.round(p * (arr.length - 1))))]!;

function useProgressIndex(
  ref: React.RefObject<HTMLElement | null>,
  n: number,
  offset: ["start start", "end end"] | ["start end", "end start"] = ["start start", "end end"],
) {
  const { scrollYProgress } = useScroll({ target: ref, offset });
  const [p, setP] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => setP(v));
  return { p, idx: Math.min(n - 1, Math.floor(p * n)), mv: scrollYProgress };
}

function Wipe({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { clipPath: "inset(0 0 100% 0)" }}
      whileInView={{ clipPath: "inset(0 0 0% 0)" }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

const Eyebrow = ({ children }: { children: ReactNode }) => (
  <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.28em] text-amber">{children}</p>
);

function Story() {
  const heat = useRef(0);
  const push = useRef(0);
  const [mounted, setMounted] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const router = useRouter();
  const { scrollYProgress } = useScroll();
  const bar = useSpring(scrollYProgress, { stiffness: 220, damping: 32 });

  useEffect(() => {
    setMounted(true);
    // Instant preload for Live EOC Console route
    router.preloadRoute({ to: "/demo" });
    const t = setTimeout(() => setLoaded(true), 1200);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-amber focus:px-4 focus:py-2 focus:text-primary-foreground focus:font-medium"
      >
        Skip to content
      </a>
      <motion.div
        className="fixed left-0 right-0 top-0 z-50 h-0.5 origin-left bg-gradient-to-r from-teal via-amber to-signal"
        style={{ scaleX: bar }}
      />
      <Cursor />
      <AnimatePresence>{!loaded && <Preloader />}</AnimatePresence>

      {/* 3D revolving particles background */}
      <div className="pointer-events-none fixed inset-0 -z-0">
        <div className="mesh absolute inset-0 opacity-40" />
        {mounted && (
          <Suspense fallback={null}>
            <div className="absolute inset-0">
              <PointCity heat={heat} push={push} />
            </div>
          </Suspense>
        )}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,var(--background)_95%)]" />
      </div>

      <Nav />
      <main id="main" className="relative z-10">
        <Hero heat={heat} push={push} />
        <IsThisNoise heat={heat} push={push} />
        <ActionSection heat={heat} />
        <Foresight />
        <TwinTest heat={heat} />
        <Reliability />
        <DashboardProp />
        <Manifesto />
      </main>
      <Footer />
    </>
  );
}

function Nav() {
  return (
    <nav
      className="fixed left-0 right-0 top-0 z-40 flex items-center justify-between gap-8 border-b border-white/[0.08] bg-background/80 px-6 py-4 backdrop-blur-xl md:px-12"
      aria-label="Primary"
    >
      <a
        href="#top"
        className="flex items-center gap-3 font-display text-2xl font-bold tracking-[0.08em] text-foreground transition-colors hover:text-amber whitespace-nowrap shrink-0"
      >
        <span>CRISTER</span>
        <span className="hidden sm:inline-block border-l border-white/10 pl-3 font-mono text-[10px] tracking-widest text-muted-foreground">
          SPATIAL FORESIGHT
        </span>
      </a>

      <div className="hidden lg:flex items-center gap-8 font-sans text-sm font-medium text-muted-foreground">
        <a
          href="#noise"
          className="hover:text-foreground transition-colors whitespace-nowrap shrink-0"
        >
          Inference
        </a>
        <a
          href="#foresight"
          className="hover:text-foreground transition-colors whitespace-nowrap shrink-0"
        >
          Causal Foresight
        </a>
        <a
          href="#twin-test"
          className="hover:text-foreground transition-colors whitespace-nowrap shrink-0"
        >
          Twin Test
        </a>
        <a
          href="#reliability"
          className="hover:text-foreground transition-colors whitespace-nowrap shrink-0"
        >
          Source Trust
        </a>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <Link
          to="/demo"
          preload="render"
          className="rounded-full bg-amber px-5 py-2 font-sans text-xs font-semibold text-primary-foreground transition-all hover:bg-amber/90 hover:scale-[1.02] shadow-[0_0_24px_rgba(245,166,35,0.25)] whitespace-nowrap shrink-0"
        >
          Live EOC Console →
        </Link>
      </div>
    </nav>
  );
}

function Cursor() {
  const [pos, setPos] = useState({ x: -100, y: -100, big: false });
  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) return;
    const m = (e: MouseEvent) =>
      setPos({
        x: e.clientX,
        y: e.clientY,
        big: !!(e.target as HTMLElement).closest("a,button,video"),
      });
    window.addEventListener("mousemove", m);
    return () => window.removeEventListener("mousemove", m);
  }, []);
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[90] hidden md:block"
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
    >
      <div className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-amber shadow-[0_0_8px_var(--amber)]" />
      <div
        className={cn(
          "absolute rounded-full border border-amber/50 transition-all duration-300",
          pos.big
            ? "-left-6 -top-6 h-12 w-12 bg-amber/10 backdrop-blur-[1px]"
            : "-left-4 -top-4 h-8 w-8",
        )}
      />
    </div>
  );
}

function Preloader() {
  const word = "CRISTER";
  return (
    <motion.div
      className="fixed inset-0 z-[80] grid place-items-center bg-background"
      exit={{ clipPath: "inset(0 0 100% 0)" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex flex-col items-center">
        <motion.div
          className="h-2.5 w-2.5 rounded-full bg-amber shadow-[0_0_12px_var(--amber)]"
          animate={{ scale: [1, 2, 1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        />
        <motion.svg
          width="260"
          height="44"
          viewBox="0 0 260 44"
          className="my-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <motion.path
            d="M0 22 H80 L90 10 L100 34 L110 6 L120 38 L130 16 L140 28 L150 22 H260"
            fill="none"
            stroke="var(--amber)"
            strokeWidth="1.5"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.3, duration: 0.7 }}
          />
        </motion.svg>
        <div className="flex font-display text-5xl font-extrabold tracking-[0.25em]">
          {word.split("").map((c, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.05 }}
            >
              {c}
            </motion.span>
          ))}
        </div>
        <motion.p
          className="mt-3 font-mono text-xs uppercase tracking-widest text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          Calibrating spatial telemetry
        </motion.p>
      </div>
    </motion.div>
  );
}

function HeroRevolvingIsland() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Subtle interactive 3D mouse tilt
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: ny * -10, y: nx * 12 });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  // Fine constellation micro-particles matching the rest of the web
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener("resize", handleResize);

    // Generate ~48 delicate micro-particles in cyan, amber, teal
    const count = 48;
    const colors = ["#22d3ee", "#38bdf8", "#f59e0b", "#34d399", "#a78bfa"] as const;
    const particles = Array.from({ length: count }, () => {
      const angle = Math.random() * Math.PI * 2;
      const dist = 80 + Math.random() * 190;
      const chosenColor: string = colors[Math.floor(Math.random() * colors.length)] ?? "#22d3ee";
      return {
        angle,
        dist,
        speed: (0.003 + Math.random() * 0.005) * (Math.random() > 0.5 ? 1 : -1),
        yOffset: (Math.random() - 0.5) * 150,
        radius: 0.9 + Math.random() * 1.5,
        color: chosenColor,
        opacity: 0.3 + Math.random() * 0.55,
        pulseSpeed: 0.02 + Math.random() * 0.03,
        pulse: Math.random() * Math.PI,
      };
    });

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      const cx = width / 2;
      const cy = height / 2;

      // Update and draw fine constellation particles orbiting the island model
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (!p) continue;
        p.angle += p.speed;
        p.pulse += p.pulseSpeed;

        const x = cx + Math.cos(p.angle) * p.dist;
        const y = cy + Math.sin(p.angle) * (p.dist * 0.42) + p.yOffset;
        const currentRadius = p.radius * (0.8 + 0.35 * Math.sin(p.pulse));
        const alpha = p.opacity * (0.7 + 0.3 * Math.sin(p.pulse));

        ctx.beginPath();
        ctx.arc(x, y, currentRadius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.shadowBlur = 6;
        ctx.shadowColor = p.color;
        ctx.fill();

        // Connect nearby particles with subtle celestial lines
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          if (!p2) continue;
          const x2 = cx + Math.cos(p2.angle) * p2.dist;
          const y2 = cy + Math.sin(p2.angle) * (p2.dist * 0.42) + p2.yOffset;
          const dx = x - x2;
          const dy = y - y2;
          const distSq = dx * dx + dy * dy;
          if (distSq < 3200) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x2, y2);
            ctx.strokeStyle = p.color;
            ctx.globalAlpha = (1 - Math.sqrt(distSq) / 58) * 0.16;
            ctx.lineWidth = 0.5;
            ctx.shadowBlur = 0;
            ctx.stroke();
          }
        }
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative w-full aspect-square max-w-[560px] flex items-center justify-center select-none"
      style={{ perspective: 1200 }}
    >
      {/* 3D Floating container with subtle physics tilt */}
      <div
        className="relative w-full h-full flex items-center justify-center transition-transform duration-300 ease-out"
        style={{
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          transformStyle: "preserve-3d",
        }}
      >
        {/* Seamless, frameless revolving 3D island model */}
        <video
          ref={videoRef}
          src="/assets/aistudio/floating_island_clean.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-contain pointer-events-none scale-110"
          style={{
            mixBlendMode: "screen",
            WebkitMaskImage:
              "radial-gradient(circle at 50% 52%, black 46%, rgba(0,0,0,0.8) 66%, transparent 88%)",
            maskImage:
              "radial-gradient(circle at 50% 52%, black 46%, rgba(0,0,0,0.8) 66%, transparent 88%)",
            filter: "contrast(1.08) brightness(1.02)",
          }}
        />

        {/* Ambient fine constellation particles matching the whole web app */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
        />

        {/* Floating coordinates indicator — zero box, pure typography */}
        <div className="absolute -bottom-1 font-mono text-[9px] tracking-[0.26em] text-teal/40 uppercase pointer-events-none select-none">
          ISLAND_ROT: 360° · GEO_ALT: +340M · HARROW_BAY
        </div>
      </div>
    </div>
  );
}

function Hero({ heat, push }: { heat: { current: number }; push: { current: number } }) {
  const [drawer, setDrawer] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    push.current = Math.min(1, v * 1.5);
  });

  return (
    <section
      id="top"
      ref={heroRef}
      className="relative flex min-h-[92vh] flex-col justify-center px-6 pt-24 pb-12 md:px-12 lg:px-16 max-w-7xl mx-auto w-full"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center w-full">
        {/* Left Column: Left-aligned funky, aesthetic, glitched landing text */}
        <div className="lg:col-span-7 flex flex-col items-start text-left">
          {/* Cyber Protocol Eyebrow Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-teal/30 bg-teal/10 px-3.5 py-1 mb-6 backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="pulse-ring absolute inset-0 rounded-full bg-teal" />
              <span className="relative h-2 w-2 rounded-full bg-teal" />
            </span>
            <span className="font-mono text-[10px] tracking-[0.25em] text-teal uppercase font-semibold">
              AUTONOMOUS CRISIS INFERENCE · SYS_REV_2.4
            </span>
          </div>

          {/* Glitched, Jittering Headline */}
          <h1 className="font-display text-4xl sm:text-6xl md:text-7xl lg:text-[76px] font-black tracking-[-0.035em] leading-[0.96] text-foreground text-left">
            <span className="block text-muted-foreground/60 text-sm sm:text-base font-mono uppercase tracking-[0.22em] mb-2 font-medium">
              [ T-00:00:00 · HARROW BAY TELEMETRY ]
            </span>
            <span
              className="glitch-wrapper jitter-subtle text-foreground select-none"
              data-text="The first ten minutes"
            >
              The first ten minutes
            </span>
            <br />
            <span className="bg-gradient-to-r from-amber via-yellow-200 to-signal bg-clip-text text-transparent drop-shadow-[0_0_35px_rgba(245,166,35,0.45)]">
              decide everything.
            </span>
          </h1>

          {/* Funky, aesthetic, punchy subtext */}
          <p className="mt-6 font-sans text-base sm:text-lg text-muted-foreground/90 max-w-xl leading-relaxed text-left">
            Online crisis inference across fractured city telemetry. Four calibrated hypotheses
            alive in real-time. Action committed only when Bayesian evidence earns it — projecting
            cascading consequences before physical impact.
          </p>

          {/* Telemetry quick badges */}
          <div className="mt-6 flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted-foreground">
            <span className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1 text-teal">
              4 HYPOTHESES ACTIVE
            </span>
            <span className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1 text-amber">
              &lt;120s ADVANCE LEAD
            </span>
            <span className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1 text-signal">
              ZERO FALSE FLAPS
            </span>
          </div>

          {/* CTAs */}
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              to="/demo"
              preload="render"
              className="rounded-full bg-amber px-8 py-3.5 font-sans text-sm font-semibold text-primary-foreground transition-all hover:bg-amber/90 hover:scale-[1.03] shadow-[0_0_28px_rgba(245,166,35,0.35)]"
            >
              Launch Live Simulation →
            </Link>
            <a
              href="#noise"
              className="rounded-full border border-teal/30 bg-teal/[0.08] px-6 py-3.5 font-sans text-sm font-medium text-teal hover:bg-teal/20 transition-colors"
            >
              Explore Inference ↓
            </a>
            <button
              onClick={() => setDrawer(true)}
              className="rounded-full border border-white/10 px-6 py-3.5 font-sans text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              System Specs
            </button>
          </div>
        </div>

        {/* Right Column: Seamlessly blended, frameless revolving 3D island model */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center w-full">
          <HeroRevolvingIsland />
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="mt-12 flex flex-col items-center gap-2 font-mono text-[10px] tracking-widest text-muted-foreground">
        <span>SCROLL DOWN TO EXPLORE REAL-TIME INFERENCE</span>
        <motion.div
          className="h-10 w-px origin-top bg-gradient-to-b from-amber to-transparent"
          animate={{ scaleY: [0, 1, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <AnimatePresence>
        {drawer && (
          <motion.div
            className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDrawer(false)}
          >
            <motion.aside
              role="dialog"
              aria-label="Brief"
              className="glass absolute bottom-0 right-0 top-0 w-full max-w-lg overflow-y-auto p-8 border-l border-white/10"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 260 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setDrawer(false)}
                className="mb-8 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                CLOSE ✕
              </button>
              <h2 className="font-display text-4xl font-bold">The Architecture</h2>
              <div className="mt-6 space-y-5 font-sans text-sm leading-relaxed text-muted-foreground">
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                  <h3 className="font-display text-base font-semibold text-foreground">
                    Layer 1 — Signal Scoring with Repetition Decay
                  </h3>
                  <p className="mt-1 text-xs">
                    Each event contributes weight × source reliability. Repeated signals from the
                    same cluster or IoT gateway decay exponentially (
                    <code className="font-mono">0.5^k</code>), preventing sensor-loop false alarms.
                    Heavy rain discounts explainable flood signals.
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                  <h3 className="font-display text-base font-semibold text-foreground">
                    Layer 2 — 4 Hypotheses & Online Bayesian Adaptation
                  </h3>
                  <p className="mt-1 text-xs">
                    Evaluates Noise, Sensor Failure, Isolated Incident, and Cascading Crisis
                    simultaneously. Prior odds shift across episodes via memory pseudo-counts
                    without offline retraining.
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                  <h3 className="font-display text-base font-semibold text-foreground">
                    Layer 3 — Lead-Time & Fatigue Cost Model
                  </h3>
                  <p className="mt-1 text-xs">
                    Evaluates expected cost of WATCH, PREPARE, ALERT, and ESCALATE. Lead-time gains
                    reward early decisive action; false-alarm penalties guard against alert fatigue.
                    Stability locks enforce minimum dwell times to prevent action flip-flop.
                  </p>
                </div>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function IsThisNoise({ heat, push }: { heat: { current: number }; push: { current: number } }) {
  const ref = useRef<HTMLElement>(null);
  const span = A.slice(0, 11); // T+00:00 → T+05:00
  const { p } = useProgressIndex(ref, span.length);
  const s = at(span, p);

  useEffect(() => {
    heat.current = s.belief.distribution.CASCADING_CRISIS;
    push.current = Math.min(1, 0.4 + p * 0.6);
  }, [s, p, heat, push]);

  return (
    <section id="noise" ref={ref} className="relative h-[220vh]">
      <div className="sticky top-0 flex min-h-screen items-center px-6 py-20 md:px-12 lg:px-16">
        <div className="grid w-full gap-8 lg:grid-cols-2 max-w-7xl mx-auto">
          <div>
            <Eyebrow>T+{fmtT(s.t)} · BRANCH A INFERENCE STREAM</Eyebrow>
            <h2 className="mb-4 font-display text-4xl md:text-6xl font-bold tracking-tight">
              Is this noise?
            </h2>
            <p className="mb-6 font-sans text-sm text-muted-foreground leading-relaxed">
              When raw culvert spikes and citizen reports trickle in, simple threshold systems
              either panic or sleep. CRISTER maps every piece of evidence against its source
              reliability.
            </p>
            <ul
              className="glass h-[50vh] overflow-y-auto rounded-2xl p-4 border border-white/[0.08]"
              aria-live="polite"
            >
              {[...s.events].reverse().map((e) => (
                <SignalRow key={e.id} e={e} sources={s.sources} />
              ))}
            </ul>
          </div>
          <div className="glass self-end rounded-2xl p-6 border border-white/[0.08] shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <p className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground">
                FOUR HYPOTHESES · LIVE
              </p>
              <span className="font-mono text-xs text-amber">
                Raw Score: {s.belief.raw_score.toFixed(2)}
              </span>
            </div>
            <HypothesisBars distribution={s.belief.distribution} />
            <p className="mt-6 font-sans text-xs text-muted-foreground leading-relaxed border-t border-white/[0.08] pt-4">
              CRISTER keeps every hypothesis alive in calibrated probabilities. It never collapses
              to one story early until trusted independent corroboration demands it.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function ActionSection({ heat }: { heat: { current: number } }) {
  const ref = useRef<HTMLElement>(null);
  const { p, mv } = useProgressIndex(ref, A.length);
  const s = at(A, 0.3 + p * 0.7);
  const change = [...s.log].reverse().find((l) => l.kind === "decision");
  const [hudVisible, setHudVisible] = useState(true);

  useEffect(() => {
    heat.current = Math.max(heat.current, ACTIONS.indexOf(s.decision.action) / 3);
  }, [s, heat]);

  // Telemetry phase text based on scroll progress
  const phase =
    p < 0.2
      ? "ORBITAL TELEMETRY · 36,000 KM"
      : p < 0.45
        ? "IONOSPHERE DESCENT · 85,000 M"
        : p < 0.7
          ? "ATMOSPHERIC INGRESS · 12,000 M"
          : "SURFACE STORM SURGE · HARROW BAY";

  const frameIdx = Math.min(240, Math.max(1, Math.round(p * 239) + 1));

  return (
    <section id="action" ref={ref} className="relative h-[260vh]">
      <div className="sticky top-0 flex h-screen items-center justify-center px-6 overflow-hidden">
        {/* Full-bleed Earth scroll-driven animation canvas */}
        <EarthScrollCanvas progressMotionValue={mv} />

        {/* Dynamic ambient backlight matching the current decision state */}
        <div
          className={cn(
            "pointer-events-none absolute h-[65vh] w-[65vh] rounded-full opacity-25 blur-[130px] transition-colors duration-1000",
            {
              WATCH: "bg-teal",
              PREPARE: "bg-amber",
              ALERT: "bg-signal",
              ESCALATE: "bg-violet",
            }[s.decision.action],
          )}
        />

        {/* Tactical HUD Header */}
        <div className="absolute top-20 inset-x-0 px-6 md:px-12 flex items-center justify-between pointer-events-none z-20">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2 w-2">
              <span className="pulse-ring absolute inset-0 rounded-full bg-teal" />
              <span className="relative h-2 w-2 rounded-full bg-teal" />
            </span>
            <span className="font-mono text-[10px] tracking-[0.25em] text-teal/90 uppercase font-semibold drop-shadow-md">
              EARTH OPTIC FEED · {phase}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="font-mono text-[10px] tracking-widest text-amber/90 uppercase drop-shadow-md hidden sm:inline-block">
              FRAME {String(frameIdx).padStart(3, "0")} / 240
            </span>

            {/* Toggle HUD button */}
            <button
              onClick={() => setHudVisible(!hudVisible)}
              className="pointer-events-auto rounded-full border border-white/20 bg-background/60 backdrop-blur-md px-3 py-1 font-mono text-[9px] tracking-wider text-muted-foreground hover:text-foreground hover:border-amber/60 hover:bg-background/80 transition-all select-none shadow-lg"
              title="Toggle Action HUD for full cinematic Earth animation"
            >
              {hudVisible ? "HIDE HUD [✕]" : "SHOW HUD [⎘]"}
            </button>
          </div>
        </div>

        {/* Action Card HUD */}
        <div
          className={cn(
            "relative z-10 w-full max-w-4xl transition-all duration-300",
            hudVisible ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none",
          )}
        >
          <Wipe className="glass relative w-full rounded-3xl p-8 md:p-12 border border-white/[0.12] bg-background/55 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between">
              <Eyebrow>THE ACTION CARD · T+{fmtT(s.t)}</Eyebrow>
              {s.decision.stability_lock && (
                <span
                  title="Hysteresis: the action holds until evidence clears a margin."
                  className="rounded-full border border-amber/60 bg-amber/10 px-3 py-1 font-mono text-[10px] font-semibold text-amber"
                >
                  STABILITY LOCK ACTIVE
                </span>
              )}
            </div>
            <ActionWord action={s.decision.action} size="xl" />
            <div className="mt-8 grid gap-8 md:grid-cols-2">
              <div>
                <p className="mb-2 font-mono text-[10px] tracking-widest text-muted-foreground">
                  REASON FOR CHANGE
                </p>
                <Typewriter
                  key={change?.text ?? "init"}
                  text={change?.text ?? "Holding WATCH. Signals are present but uncorroborated."}
                  className="font-sans text-sm leading-relaxed text-foreground/90"
                />
              </div>
              <div>
                <p className="mb-2 font-mono text-[10px] tracking-widest text-muted-foreground">
                  EXPECTED ACTION COST MATRIX
                </p>
                <CostPanel
                  costs={s.decision.expected_cost_per_action}
                  action={s.decision.action}
                  argmin={s.decision.argmin_action}
                />
              </div>
            </div>
          </Wipe>
        </div>

        {/* Telemetry bottom progress bar */}
        <div className="absolute bottom-4 inset-x-6 md:inset-x-12 flex items-center justify-between pointer-events-none z-20 font-mono text-[9px] tracking-widest text-muted-foreground/60">
          <span>HARROW BAY DESCENT VECTOR</span>
          <div className="w-32 md:w-48 h-0.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-teal via-amber to-signal transition-all duration-75"
              style={{ width: `${p * 100}%` }}
            />
          </div>
          <span>SCROLL TO ADVANCE</span>
        </div>
      </div>
    </section>
  );
}

function Foresight() {
  const ref = useRef<HTMLElement>(null);
  const { p } = useProgressIndex(ref, 10);
  const s = at(A, 0.25 + p * 0.5);
  const exposure = useMemo(() => zoneExposure(s.events, s.t), [s]);

  return (
    <section id="foresight" ref={ref} className="relative h-[220vh]">
      <div className="sticky top-0 grid min-h-screen items-center gap-8 px-6 py-20 md:px-12 lg:px-16 lg:grid-cols-[1fr_1.2fr] max-w-7xl mx-auto">
        <div>
          <Eyebrow>LAYER 3B · SPATIAL CONSEQUENCE FORESIGHT</Eyebrow>
          <h2 className="mb-4 font-display text-4xl md:text-6xl font-bold tracking-tight">
            Where it goes next.
          </h2>
          <p className="mb-8 font-sans text-sm text-muted-foreground leading-relaxed">
            Inference without foresight is reactive triage. CRISTER walks the city's causal graph to
            project the next 3 cascading events with estimated arrival windows.
          </p>
          <div className="relative space-y-6">
            <svg
              className="absolute left-4 top-6 h-[calc(100%-3rem)] w-2"
              preserveAspectRatio="none"
              viewBox="0 0 2 100"
              aria-hidden
            >
              <motion.line
                x1="1"
                y1="0"
                x2="1"
                y2="100"
                stroke="var(--amber)"
                strokeDasharray="2 2"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: Math.min(1, p * 1.6) }}
              />
            </svg>
            {s.predictions.map((pr, i) => (
              <motion.div
                key={`${pr.event_type}-${i}`}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="glass relative ml-10 rounded-xl p-4 border border-white/[0.08]"
              >
                <span className="absolute -left-[30px] top-5 h-3 w-3 rounded-full border-2 border-amber bg-background" />
                <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
                  <span>NEXT +{i + 1}</span>
                  <span>{Math.round(pr.confidence * 100)}% conf.</span>
                </div>
                <p className="mt-1 font-sans text-sm font-semibold">{pr.label}</p>
                <p className="font-mono text-xs text-amber mt-0.5">
                  T+{fmtT(pr.window_start)} – {fmtT(pr.window_end)} · {pr.location}
                </p>
                {pr.because && pr.because.length > 0 && (
                  <p className="mt-1 font-mono text-[9px] text-muted-foreground truncate">
                    path: {pr.because.join(" → ")}
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        </div>
        <div className="glass relative rounded-3xl p-6 border border-white/[0.08] shadow-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between font-mono text-[10px] tracking-widest text-foreground mb-3">
            <span className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="pulse-ring absolute inset-0 rounded-full bg-signal" />
                <span className="h-2 w-2 rounded-full bg-signal" />
              </span>
              REAL-TIME VECTOR SPATIAL MAP · HARROW BAY
            </span>
            <span className="text-muted-foreground hidden sm:inline">DYNAMIC ROAD RISK</span>
          </div>
          <div className="relative aspect-square w-full min-h-[360px] rounded-2xl overflow-hidden border border-white/10">
            <CityMap
              exposure={exposure}
              pCrisis={s.decision.p_crisis}
              showRoute={ACTIONS.indexOf(s.decision.action) >= 1}
            />
          </div>
          <p className="font-mono text-[10px] text-muted-foreground text-center mt-3">
            Amber: at risk · Red: culverts closed · Green: emergency response route
          </p>
        </div>
      </div>
    </section>
  );
}

function TwinPanel({ arr, p, side }: { arr: EngineState[]; p: number; side: "A" | "B" }) {
  const s = at(arr, p);
  const stamp = p > 0.85;

  return (
    <div className="relative p-5 md:p-8 flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <p
          className={cn(
            "font-mono text-xs tracking-[0.25em] font-bold",
            side === "A" ? "text-signal" : "text-teal",
          )}
        >
          BRANCH {side} · T+{fmtT(s.t)}
        </p>
        <span className="font-mono text-[11px] text-muted-foreground">
          P(crisis) = {(s.decision.p_crisis * 100).toFixed(0)}%
        </span>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <ActionWord action={s.decision.action} />
        <span
          className={cn(
            "rounded-md px-2.5 py-0.5 font-mono text-[11px] font-semibold border",
            side === "A"
              ? "bg-signal/15 text-signal border-signal/30"
              : "bg-teal/15 text-teal border-teal/30",
          )}
        >
          {side === "A" ? "ESCALATING FLOOD FEED" : "FALSE ALARM RETRACTED"}
        </span>
      </div>

      {/* Synchronized Real Video Stream replacing abstract graphs */}
      <div className="relative w-full aspect-video min-h-[300px] rounded-2xl overflow-hidden border border-white/10 shadow-2xl my-2 flex-1">
        <BranchVideoInjector
          branch={side}
          t={s.t}
          progress={p}
          action={s.decision.action}
          pCrisis={s.decision.p_crisis}
          showEvacuationGuide={true}
          className="h-full w-full"
        />
      </div>

      <AnimatePresence>
        {stamp && (
          <motion.div
            initial={{ scale: 2, opacity: 0, rotate: -12 }}
            animate={{ scale: 1, opacity: 1, rotate: -8 }}
            className={cn(
              "absolute right-8 top-16 rounded border-4 px-4 py-1.5 font-mono text-xl font-extrabold tracking-widest shadow-2xl z-30",
              side === "A"
                ? "border-signal bg-signal/25 text-signal backdrop-blur"
                : "border-teal bg-teal/25 text-teal backdrop-blur",
            )}
          >
            {side === "A" ? "COMMIT" : "RECALIBRATE"}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TwinTest({ heat }: { heat: { current: number } }) {
  const ref = useRef<HTMLElement>(null);
  const { p } = useProgressIndex(ref, 100);

  useEffect(() => {
    heat.current = 0.6;
  }, [heat]);

  return (
    <section id="twin-test" ref={ref} className="relative h-[240vh]">
      <div className="sticky top-0 min-h-screen px-4 py-16 md:px-10 max-w-7xl mx-auto flex flex-col justify-center">
        <div className="text-center max-w-3xl mx-auto">
          <Eyebrow>SERVER-SIDE TWIN TEST</Eyebrow>
          <h2 className="font-display text-4xl md:text-6xl font-bold tracking-tight">
            Same first seven events.
          </h2>
          <p className="mt-3 font-sans text-sm text-muted-foreground">
            Both branches start with identical rain and culvert telemetry. Branch A escalates into
            an ED surge; Branch B receives a gateway retraction. Calibration is the difference
            between costly false alarms and fast commitment.
          </p>
        </div>
        <div className="glass relative mt-8 grid overflow-hidden rounded-3xl md:grid-cols-2 border border-white/[0.08] shadow-2xl">
          <TwinPanel arr={A} p={p} side="A" />
          <TwinPanel arr={B} p={p} side="B" />
          <div className="absolute bottom-0 left-1/2 top-0 hidden w-px -translate-x-1/2 bg-gradient-to-b from-signal via-amber to-teal md:block">
            <motion.div
              className="absolute inset-0 bg-foreground"
              animate={{ opacity: [0.1, 0.8, 0.1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function Reliability() {
  const ref = useRef<HTMLElement>(null);
  const { p, mv } = useProgressIndex(ref, 100);
  const x = useTransform(mv, [0, 1], ["5%", "-40%"]);
  const base = A.at(-1)!.sources.filter((s) => s.id !== "gateway" && s.id !== "weather");
  const cut = p > 0.45;
  const shown = base.map((s) =>
    cut && ["camera", "citizen", "drainage"].includes(s.id)
      ? {
          ...s,
          status: "offline" as const,
          current_reliability: Math.max(0.05, s.current_reliability - 0.4),
        }
      : s,
  );

  return (
    <section id="reliability" ref={ref} className="relative h-[200vh]">
      <div className="sticky top-0 flex min-h-screen flex-col justify-center overflow-hidden">
        <div className="relative px-6 md:px-16 max-w-7xl mx-auto w-full">
          <Eyebrow>ONLINE BAYESIAN LEARNING</Eyebrow>
          <h2 className="font-display text-4xl md:text-6xl font-bold tracking-tight">
            Trust is earned, and lost.
          </h2>
          <p className="mt-3 font-sans text-sm text-muted-foreground max-w-xl">
            Reliability is not static. Sources that report confirmed crises gain pseudo-count
            credibility; retracted sensors lose trust; cutouts widen uncertainty without panic
            actions.
          </p>
          <AnimatePresence>
            {cut && (
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-4 inline-block rounded-full bg-amber/15 px-4 py-1.5 font-mono text-xs text-amber border border-amber/30"
              >
                Simulated Cutout: 3 sources offline — belief widened, action held 120s.
              </motion.p>
            )}
          </AnimatePresence>
        </div>
        <motion.div style={{ x }} className="relative mt-10 flex gap-4 px-6 md:px-16">
          {shown.map((s) => (
            <SourceCard key={s.id} s={s} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function DashboardProp() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const scale = useTransform(scrollYProgress, [0, 1], [0.8, 1]);
  const rotate = useTransform(scrollYProgress, [0, 1], [-8, 0]);
  const s = A[9]!;

  return (
    <section
      ref={ref}
      className="relative flex min-h-[140vh] flex-col items-center justify-center px-6 py-24"
    >
      <Eyebrow>MISSION CONTROL READY</Eyebrow>
      <h2 className="mb-4 text-center font-display text-4xl md:text-6xl font-bold tracking-tight">
        Now watch it live.
      </h2>
      <p className="mb-10 text-center font-sans text-sm text-muted-foreground max-w-xl">
        Experience interactive simulation control: inject sensor cutouts, retract anomalies, compare
        branches, and run multi-day online learning directly in the operational dashboard.
      </p>
      <motion.div
        style={{ scale, rotateX: rotate as MotionValue<number> }}
        className="glass w-full max-w-5xl rounded-3xl p-6 shadow-2xl border border-white/[0.1] [perspective:1200px]"
      >
        <div className="mb-4 flex items-center justify-between border-b border-border pb-3 font-mono text-[11px] text-muted-foreground">
          <span className="font-display text-lg font-bold text-foreground">CRISTER LIVE EOC</span>
          <span className="rounded bg-amber/10 px-2 py-0.5 text-amber">
            BRANCH A · T+{fmtT(s.t)}
          </span>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <ul className="max-h-72 overflow-hidden space-y-2">
            {[...s.events]
              .reverse()
              .slice(0, 4)
              .map((e) => (
                <SignalRow key={e.id} e={e} sources={s.sources} />
              ))}
          </ul>
          <div className="space-y-4">
            <HypothesisBars distribution={s.belief.distribution} compact />
            <ActionWord action={s.decision.action} />
          </div>
          <div className="aspect-square w-full relative min-h-[260px] rounded-xl overflow-hidden border border-white/10">
            <CityMap
              exposure={zoneExposure(s.events, s.t)}
              pCrisis={s.decision.p_crisis}
              showRoute
            />
          </div>
        </div>
      </motion.div>
      <Link
        to="/demo"
        preload="render"
        className="mt-12 rounded-full bg-amber px-10 py-4 font-sans text-sm font-semibold text-primary-foreground transition-all hover:bg-amber/90 hover:scale-[1.03] shadow-[0_0_30px_rgba(245,166,35,0.35)]"
      >
        Open CRISTER Interactive Demo →
      </Link>
    </section>
  );
}

const LINES = [
  "Most systems wait for the disaster to become visible.",
  "We read the first faint signals before the flood arrives.",
  "We stay honest when evidence is uncorroborated.",
  "We commit decisively only when the math earns it.",
  "And we show you exactly why we changed our mind.",
];

function Manifesto() {
  const ref = useRef<HTMLElement>(null);
  const { idx } = useProgressIndex(ref, LINES.length);

  return (
    <section ref={ref} className="relative h-[280vh]">
      <div className="sticky top-0 grid min-h-screen place-items-center overflow-hidden px-6">
        <motion.div
          className="mesh absolute inset-0"
          animate={{ opacity: 0.25 + idx * 0.1, scale: 1 + idx * 0.04 }}
          transition={{ duration: 1.2 }}
        />
        <AnimatePresence mode="wait">
          <motion.p
            key={idx}
            initial={{ opacity: 0, y: 28, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -28, filter: "blur(10px)" }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="relative max-w-4xl text-center font-display text-4xl sm:text-5xl md:text-6xl font-bold leading-tight"
          >
            {LINES[idx]}
          </motion.p>
        </AnimatePresence>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="relative z-10 flex min-h-[36vh] flex-col justify-between border-t border-white/[0.08] bg-background px-6 py-12 md:px-16">
      <div className="max-w-7xl mx-auto w-full">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-white/[0.08]">
          <div>
            <p className="font-display text-5xl md:text-7xl font-extrabold tracking-[0.08em] text-foreground">
              CRISTER
            </p>
            <p className="mt-3 font-sans text-sm text-muted-foreground">
              Honest inference. Cost-aware commitment. Spatial foresight.
            </p>
          </div>
          <Link
            to="/demo"
            preload="render"
            className="rounded-full bg-amber px-6 py-2.5 font-sans text-xs font-semibold text-primary-foreground hover:bg-amber/90 transition-colors self-start md:self-auto"
          >
            Launch EOC Demo →
          </Link>
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-6 text-xs text-muted-foreground font-sans">
          <nav className="flex gap-6" aria-label="Footer">
            <a href="#top" className="hover:text-amber transition-colors">
              Overview
            </a>
            <a href="#floating-city" className="hover:text-amber transition-colors">
              Floating City Model
            </a>
            <a href="#noise" className="hover:text-amber transition-colors">
              Inference Stream
            </a>
            <a href="#twin-test" className="hover:text-amber transition-colors">
              Twin Test
            </a>
            <a href="/api/public/episodes/branch_a" className="hover:text-amber transition-colors">
              Raw Episode JSON
            </a>
          </nav>
          <p className="font-mono text-[10px] text-muted-foreground/80">
            CASCADE '26 · Problem 1 · Autonomous Crisis Inference
          </p>
        </div>
      </div>
    </footer>
  );
}
