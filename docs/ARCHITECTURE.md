# Architecture

## Current foundation
- TypeScript + Vite + Three.js
- One `Game` composition root
- Input, player/controller, camera, and world kept as small modules
- No physics library until collision/vehicle needs justify it

## Update model
`requestAnimationFrame` drives rendering; gameplay receives clamped frame delta. A fixed-step physics loop can be introduced only if physics becomes necessary.
