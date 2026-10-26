import { useEffect, useRef, useState, useCallback, memo } from "react";
import { useMotionValueEvent, type MotionValue } from "framer-motion";

interface EarthScrollSequenceProps {
  /** Total number of frames in the sequence (default: 240) */
  frameCount?: number;
  /** MotionValue for scroll progress (0 to 1) */
  progressMotionValue?: MotionValue<number>;
  /** Numeric progress (0 to 1) */
  progress?: number;
  /** Optional className */
  className?: string;
}

const TOTAL_FRAMES = 240;

function getFrameUrl(index: number): string {
  const padded = String(index).padStart(3, "0");
  return `/earth-frames/ezgif-frame-${padded}.jpg`;
}

export const EarthScrollCanvas = memo(function EarthScrollCanvas({
  frameCount = TOTAL_FRAMES,
  progressMotionValue,
  progress,
  className,
}: EarthScrollSequenceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<(HTMLImageElement | null)[]>([]);
  const currentDrawnIndex = useRef<number>(1);
  const [, setRerenderTrigger] = useState<number>(0);

  // Draw a frame to canvas with high-dpi cover scaling
  const drawFrame = useCallback(
    (frameIdx: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) return;

      // Find the requested image, or fallback to the closest loaded one
      let img = imagesRef.current[frameIdx];
      if (!img || !img.complete || img.naturalWidth === 0) {
        img = imagesRef.current[currentDrawnIndex.current];
        if (!img || !img.complete || img.naturalWidth === 0) {
          // Search backwards for the closest loaded frame
          for (let i = frameIdx; i >= 1; i--) {
            if (imagesRef.current[i]?.complete && imagesRef.current[i]!.naturalWidth > 0) {
              img = imagesRef.current[i];
              break;
            }
          }
        }
      }

      if (!img || !img.complete || img.naturalWidth === 0) return;

      currentDrawnIndex.current = frameIdx;

      const cw = canvas.width;
      const ch = canvas.height;
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;

      // High quality cover scaling
      const scale = Math.max(cw / iw, ch / ih);
      const nw = iw * scale;
      const nh = ih * scale;
      const cx = (cw - nw) / 2;
      const cy = (ch - nh) / 2;

      ctx.drawImage(img, cx, cy, nw, nh);
    },
    [frameCount],
  );

  // Window resize handler
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleResize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      drawFrame(currentDrawnIndex.current);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [drawFrame]);

  // Preload frames in prioritized batches
  useEffect(() => {
    imagesRef.current = new Array(frameCount + 1).fill(null);
    let isMounted = true;

    // 1. Immediately load frame 1 for instant initial paint
    const f1 = new Image();
    f1.src = getFrameUrl(1);
    f1.onload = () => {
      if (!isMounted) return;
      imagesRef.current[1] = f1;
      drawFrame(1);
      setRerenderTrigger((n) => n + 1);
    };
    imagesRef.current[1] = f1;

    // 2. Load keyframes (every 3rd frame) first for fast responsive scrubbing
    const keyIndices: number[] = [];
    const secondaryIndices: number[] = [];
    for (let i = 2; i <= frameCount; i++) {
      if (i % 3 === 0) {
        keyIndices.push(i);
      } else {
        secondaryIndices.push(i);
      }
    }

    const loadIndices = (indices: number[]) => {
      indices.forEach((idx) => {
        const img = new Image();
        img.src = getFrameUrl(idx);
        img.onload = () => {
          if (!isMounted) return;
          imagesRef.current[idx] = img;
          if (currentDrawnIndex.current === idx) {
            drawFrame(idx);
          }
        };
        imagesRef.current[idx] = img;
      });
    };

    // Load key frames right away
    loadIndices(keyIndices);

    // Load remaining frames shortly after
    const timer = setTimeout(() => {
      if (isMounted) loadIndices(secondaryIndices);
    }, 100);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [frameCount, drawFrame]);

  // Direct 60fps animation subscription without React state overhead
  useEffect(() => {
    if (!progressMotionValue) return;
    const unsubscribe = progressMotionValue.on("change", (latest) => {
      const clamped = Math.min(1, Math.max(0, latest));
      const targetIdx = Math.min(
        frameCount,
        Math.max(1, Math.round(clamped * (frameCount - 1)) + 1),
      );
      drawFrame(targetIdx);
    });
    return () => unsubscribe();
  }, [progressMotionValue, frameCount, drawFrame]);

  // If numeric progress prop changes directly
  useEffect(() => {
    if (progress !== undefined) {
      const clamped = Math.min(1, Math.max(0, progress));
      const targetIdx = Math.min(
        frameCount,
        Math.max(1, Math.round(clamped * (frameCount - 1)) + 1),
      );
      drawFrame(targetIdx);
    }
  }, [progress, frameCount, drawFrame]);

  return (
    <div className={`absolute inset-0 pointer-events-none overflow-hidden ${className ?? ""}`}>
      {/* HTML Canvas */}
      <canvas
        ref={canvasRef}
        className="h-full w-full object-cover"
        style={{ filter: "contrast(1.05) brightness(1.02)" }}
      />

      {/* Top seamless blending gradient into noise section */}
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-background via-background/60 to-transparent" />

      {/* Bottom seamless blending gradient into foresight section */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background via-background/60 to-transparent" />

      {/* Left and right subtle vignettes for depth */}
      <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-background/40 to-transparent" />
      <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-background/40 to-transparent" />
    </div>
  );
});
