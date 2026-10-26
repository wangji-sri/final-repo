import { createServerFn } from "@tanstack/react-start";
import { compare } from "@/engine/engine";
import type { EpisodeName } from "@/engine/fixtures";

const NAMES = ["branch_a", "branch_b", "cutout_demo", "messy_stream"] as const;

/** Server-side Twin Test: replays both episodes through the engine and diffs them per tick. */
export const compareBranches = createServerFn({ method: "POST" })
  .inputValidator((d: { a: string; b: string }) => {
    if (!NAMES.includes(d.a as EpisodeName) || !NAMES.includes(d.b as EpisodeName))
      throw new Error("Unknown episode");
    return d as { a: EpisodeName; b: EpisodeName };
  })
  .handler(async ({ data }) => compare(data.a, data.b, 30));
