# Reference provenance and reconstruction

Source folder: https://drive.google.com/drive/folders/10U0Q5uyI6LHZ5a7NmWhGYDgkmoEgJtQd

Phase 1 was reassembled in numeric order from `.zip.001` through `.zip.004` in the Fort Kochi subfolder. Phase 2 was extracted from `Mud_Meals_Phase_2_Kochi_Urban_All_Scenes.zip`. ZIP integrity was checked while extracting. Scene specifications are copied unmodified into `public/scenes/*/scene_spec.json`. PNG references are converted to WebP (maximum 1600 × 1000, quality 88) for in-game comparison. The original archives remain outside the repository under `/workspace/references`.

| Phase | Scenes | Main landmarks |
|---|---|---|
| 1 · Fort Kochi | Waterfront; Chinese fishing nets; Heritage street; Market and residential | Pier, paired fishing nets, chapel |
| 2 · Kochi Urban | Restaurant junction; Commercial street/bus stop; Market loading lane; Canal bridge | Bus shelter/bay, single slab bridge |

The source axes are east/north/up. The mapping to Three.js is `[x + originX, z + originZ, -y - originY]`. Zone origins are applied once. Road endpoints extending beyond a block are clipped at its boundary; paired scenes continue the same road. The four-metre to six-metre taper at the heritage/market seam is interpolated from the supplied profile. Both zones overlap in their local reference coordinates and are kept separate; an invented inter-phase road would violate the supplied placement contract.

Geometry is derived from the JSON rather than an image used as a skybox or ground plane. Camera presets change the camera only. The master/player captures produced by the browser check contain actual modeled WebGL geometry. Reference overlays are explicitly labeled. Runtime audits compare modeled building footprint records with source data; paired endpoint positions and widths are checked directly.

The original archives explicitly state that images are generated reference illustrations, not calibrated views of one common mesh. They do not certify exact multi-view consistency. Architectural detail, foliage density and projected dimensions vary among images. The reconstruction uses supplied footprints, entrances, heights, roof categories and major props as geometry authority. Windows, foliage and material maps are authored approximations. Signage uses readable English business labels; reliable reviewed Malayalam text was not supplied. No unreviewed generated glyphs are treated as readable Malayalam.

The user requested identical appearance. That acceptance target has **not** been met or certified by this implementation. Exact pixel agreement would require resolving conflicting views and additional asset/material and camera calibration work. Automated checks establish functional and spatial properties, not visual identity.

Gameplay is a small delivery loop with collection, customer delivery, countdown and rewards. Rivals, combat, interiors, dismounting/pier walking and weather variants are not implemented. Vehicles use lane movement and box collision rather than a general physics engine. Delivery bays on the mainland keep pier deliveries off the pier. Buildings, walls and water constrain the rider. Traffic is hidden and pedestrian motion is stopped in reference camera modes. Open edges outside the specified zone are blocked by the playable bounds.

Rendering defaults to 30 FPS, caps pixel density at 1.5, uses a 2048-pixel directional shadow map, pauses simulation/rendering in hidden tabs, skips redraws of static reference cameras, uses GPU fences to avoid queued frames, and merges fixed geometry by material. Fixed vehicle parts are merged while the movable bike retains its parent transform and the rider retains its skinned rig. Physical phone heat and sustained device frame rates have not been measured.
