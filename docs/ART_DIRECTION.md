# Mud Meals art direction

Phase 1 follows the 15 October 2026 V2 archive recorded in [phase1-source.json](phase1-source.json). Its four Fort Kochi scenes and 30 reference images supersede the earlier close chase-camera direction. The archive's `ART_DIRECTION.md`, `BUILD_GUIDE.md` and per-scene quality reviews are retained under `/workspace/references/phase1-v2/`.

Use an elevated oblique miniature-city camera, moderate perspective, visible roofs, compact readable actors, warm cream/ochre/teal/pink plaster, terracotta barrel tiles, grouped tropical planting and turquoise water. Keep the ground filling the gameplay frame. Fit cameras to each street direction; the heritage street needs a side view of its east–west route and north junction. The existing HUD is separate from world art.

Keep the original metre-scale footprints, road widths, entrances, delivery bays and reciprocal connections. Do not move buildings or compress the waterfront to imitate a conflicting generated illustration. Decorative planting and furniture must leave roads, pickup approaches, gates and the chapel footpath clear. The net promenade is pedestrian-only; the pier delivery stops on the mainland.

The four scenes share modeled storefront glazing, striped awnings, shutter windows, planters, rounded vehicles and people. Scene details include the delivery pier, paired cantilever fishing nets, chapel/bell tower, workshop loading yard, fruit stalls, clothing display and residential balconies. Geometry stays fixed across camera presets.

The renderer uses ACES tone mapping, a warm directional sun, environment/hemisphere fill, filtered shadows and alpha-aware GTAO at every viewport size, with an independently capped occlusion buffer. Static scenery is batched by material and spatial cell, while vehicles and people retain their actor transforms. Source images are displayed only in the labelled comparison overlay and gallery. Actual renders come from Chromium/WebGL captures.

Graphics remains the project gate. Functional checks establish source geometry, connected access, camera rendering and controls; they do not certify pixel identity or physical-phone performance. The independently generated V2 views are not calibrated images of a shared original mesh. Current authored materials and models remain visibly different from those illustrations.
