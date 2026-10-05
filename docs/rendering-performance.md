# Rendering work and device heat

The archived scene measurements below predate replacement of the imported city layout. They document the rendering optimizations, not performance of the current image-inspired city.

Both playable modes use a 30 FPS render budget by default, with a 60 FPS option. This reduces unnecessary work on 60–144 Hz displays while preserving time-based driving and animation. It is a frame cap, not a promise that every device can sustain 30 FPS.

Hidden tabs stop rendering and simulation. Paused scenes redraw only for changes, including camera/settings edits; paused free-camera controls remain usable without continuous rendering. GPU fences prevent queued frames, and elapsed time is retained across short GPU waits. Held controls clear when the page loses focus or becomes hidden.

## Changes that retain scene detail

- Fixed vehicle parts sharing a material now use one merged, indexed geometry. Wheels, transparent glass and animated parts stay separate. Source model hierarchies remain available for inspection and dimension checks, with their redundant draw layers disabled.
- Scenery uses spatial batches, so distant cells outside the camera and shadow views can be culled. The flat game ground uses two triangles rather than a subdivided terrain mesh.
- Off-screen actor rigs skip animation; their movement and collision simulation continue. Nearby actors remain available to cast shadows, and culling refreshes on camera changes even while paused.
- The colour pass refreshes shadows once. The AO normal pass reuses them, retaining the original shadow resolution and AO settings. Model inspection renders explicitly refresh their own shadow maps.
- Sharp rendering retains native pixel density up to 2×. It no longer forces 1.25× supersampling on 1× screens; multisample antialiasing remains enabled. The existing user-selected detail/balanced modes remain available.

Models, roof construction, leaves, material maps, texture resolution and visible triangle detail were retained. No new dependencies or photographic asset substitutions were introduced.

## Controlled measurements

Measured on 2026-10-04 in headless Chromium at 1280 × 720, Sharp/detail enabled, native 1× pixel density, fixed starting cameras. Three samples follow a warm-up frame. Counts include the colour, AO and shadow passes; these are submitted triangles, not unique model triangles.

The comparison below isolates rigid vehicle batching on the same rebuilt scenes, after frame scheduling, actor culling and spatial batching were already enabled:

| Scene | Calls before rigid batching | Calls after | Reduction | Submitted triangles before and after |
| --- | ---: | ---: | ---: | ---: |
| Village game | 9,056 | 4,974 | 45.1% | 12,277,058 |
| Fort Kochi waterfront | 11,884 | 10,042 | 15.5% | 14,623,401 |

Identical submitted triangle counts support the geometry-preserving change. Geometry checks also compare transformed vertices, metre-scale dimensions and independently rolling wheels. Textures remain unchanged by rigid batching.

The original pre-rebuild geographic scene used a different Ernakulam snapshot and camera. Its measurements are retained as historical context, not a direct speed comparison with Fort Kochi. Cloud frame timings are noisy and do not represent phone hardware or measured temperature.

Reproduce with a built preview on port 4173:

```sh
node scripts/profile-rendering.mjs
```

The output is `artifacts/performance/after.json`. The session's comparison files are archived in [performance measurements](performance/). `renderer.info.autoReset` is disabled during each sample, and `gl.finish()` waits for the submitted GPU work.

## Verification and limits

Frame-loop checks cover 30/60 FPS pacing on 60/90/120/144 Hz displays, elapsed simulation time, hidden-tab resume, paused redraws and GPU backpressure. Geographic/browser checks cover coast holes, full-bike road and service-passage clearance, three delivery bays, timed orders, model switching and simultaneous mobile acceleration/steering. The original village browser suite covers rendering, people, traffic, weather, cameras and responsive layout.

Physical-phone temperature and sustained frame times cannot be measured in this cloud environment. The map still contains substantial geometry; a real device may remain GPU-limited in Sharp mode. No automatic quality reduction was added. On a 60 Hz display capable of keeping up, the 30 FPS cap schedules half as many renders as 60 FPS, but actual battery and thermal savings depend on the device.

## October 5 street refinement

Kochi shade-tree crowns now use spatially batched alpha-tested leaf clusters instead of opaque icosahedra with small individual mesh leaves. For each tree, the crown falls from 9 × (320 + 16 × 48) = 9,792 source triangles to 9 × 24 × 2 = 432 triangles, while adding visible gaps and individual leaf texture detail. Trunks and branches remain. Alpha-tested foliage can still cost fill rate on phones, so this geometry reduction is not a measured temperature guarantee.

The static daylight sky and water colour textures add no reflection camera or dynamic render pass. Existing 30 FPS scheduling, paused/hidden-tab suspension, actor culling, GPU backpressure, spatial batching and selectable detail settings remain.
