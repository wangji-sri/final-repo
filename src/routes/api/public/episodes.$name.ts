import { createFileRoute } from "@tanstack/react-router";
import { replay } from "@/engine/engine";
import { EPISODES, type EpisodeName } from "@/engine/fixtures";

// Public, read-only: deterministic replay of a scripted episode (no private data).
export const Route = createFileRoute("/api/public/episodes/$name")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!Object.hasOwn(EPISODES, params.name)) {
          return new Response("Unknown episode", { status: 404 });
        }
        const states = replay(params.name as EpisodeName, 30);
        const last = states.at(-1)!;
        return Response.json(
          {
            episode: params.name,
            beliefs: states.map((s, idx) => ({
              ...s.belief,
              explanation: idx === states.length - 1 ? s.belief.explanation : undefined,
            })),
            decisions: states.map((s) => s.decision),
            predictions: last.predictions,
            events: last.events,
            sources: last.sources,
          },
          {
            headers: {
              "Cache-Control": "public, max-age=60",
            },
          },
        );
      },
    },
  },
});
