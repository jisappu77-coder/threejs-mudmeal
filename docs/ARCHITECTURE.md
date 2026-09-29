# Architecture

## Current foundation
- TypeScript + Vite + Three.js
- One `Game` composition root
- Input, player/controller, camera, missions, and world kept as focused modules
- No physics library until collision/vehicle needs justify it
- Post-processing uses EffectComposer with SMAA and output pass

## Asset architecture
- `AssetRegistry.ts` owns stable semantic asset IDs and production paths.
- `AssetManager.ts` owns GLTF loading, caching, cloning, shadow/material setup, and graceful fallback behavior.
- Gameplay/collision remains independent from rendered models.
- Procedural meshes stay available until each production GLB is validated.

## Update model
`requestAnimationFrame` drives rendering; gameplay receives clamped frame delta. A fixed-step physics loop can be introduced only if physics becomes necessary.
