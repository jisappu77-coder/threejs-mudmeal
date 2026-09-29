# Roadmap

## Graphics Gate — FIRST PRIORITY

No new gameplay systems are added until the reference-scene visual target is substantially matched.

### Acceptance criteria
- Camera/composition reads like the supplied reference.
- Production-quality motorcycle/rider assets.
- Production-quality Kerala house/shop/vehicle/vegetation GLBs.
- Authored PBR materials for road, roof, plaster, concrete, foliage and water.
- Strong environment lighting, contact shading and atmospheric depth.
- Dense roadside set dressing with no obvious prototype-empty areas.
- Mobile still renders the target composition clearly and smoothly.

### Current blocker
The committed GLBs are prototype-scale assets and are not detailed enough to match the reference image. They remain temporary until replaced.

---

## M0 — Foundation
- Documentation
- Vite + TypeScript + Three.js

## M1 — Driving prototype
- Arcade acceleration/braking
- Speed-sensitive steering
- Visual lean
- Follow camera
- Small test district
- Collision prototype
- Production build validation

Status: production build passes. Further gameplay polish is paused behind the Graphics Gate.

## M2 — Delivery prototype
- Restaurant pickup marker
- Customer drop-off marker
- Distance guidance
- Proximity pickup/drop-off
- Reward on completion
- Production build validation

Status: playable prototype exists. Further mission/economy work is paused behind the Graphics Gate.

Deferred until Graphics Gate passes:
- Mission generation
- Economy
- Upgrades
- Multiple delivery types
- World expansion
- Traffic AI expansion
