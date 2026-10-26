<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

## Project rules

- The Sentinel inference engine lives in `src/engine/` as pure, deterministic TypeScript with no browser/Node APIs, so the same code runs in the dashboard, server functions and tests.
- Engine behaviour (branch outcomes, reliability deltas, stability lock) is pinned by `src/engine/engine.test.ts`; update tests when tuning constants.
- MapLibre is loaded via dynamic import inside an effect and its container must use inline `position:absolute` (maplibre CSS overrides utility classes).
- Landing-page numbers rendered into SVG attributes must be rounded to avoid SSR hydration mismatches.
