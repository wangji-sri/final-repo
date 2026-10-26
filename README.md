# CRISTER — Crisis Inference Engine

CRISTER is a full-stack, cinematic web application for a real-time crisis-inference and spatial-consequence engine, featuring:

1. **The Story (`/`)**: A scroll-animated product experience walking a visitor through the first ten minutes of a city crisis, featuring Three.js point-cloud city visualization, live signal feed preview, hypothesis gauges, action card morphing, split foresight cards, the Twin Test split reveal comparing Branch A vs Branch B, source reliability cards, and manifesto.
2. **The Product (`/demo`)**: A live emergency-operations (EOC) dashboard with a complete deterministic inference engine calculating signal scoring, hypothesis distributions (Noise, Sensor Failure, Isolated Incident, Cascading Crisis), decision cost matrix with stability lock, synchronized real-life video telemetry stream injectors, evacuation dispatch guidance, and causal graph foresight predicting the next three events. Includes interactive controls to play Branch A/B, inject cutouts, and retract signals with instant live recalibration.

**Live demo:** https://bbb-jet-chi.vercel.app
🎬 **Live console:** https://bbb-jet-chi.vercel.app/demo
📄 **Episode data (JSON):** https://bbb-jet-chi.vercel.app/api/public/episodes/branch_a

## Development

Prerequisites: Node.js 22 and npm.

```sh
npm install
npm run dev
```

## Test Suite

```sh
npm test
```
