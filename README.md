# Mud Meals · Fort Kochi & Kochi Urban

A Three.js delivery game rebuilt from the two scene archives in the connected **Mudmeals** Google Drive folder. Both phases have four scenes. The supplied metre coordinates, buildings, roof categories, major props and connections form the base layouts, with fixed image-derived calibration described below. All 59 supplied camera views can be selected in Settings.

```sh
npm ci
npm run dev
```

Requires Node.js 22+ and WebGL 2. Open the local Vite URL. `index.html` and the retained `real-map.html` entry both open the rebuilt game. Choose **Settings → Phase → Scene** to start in another block. Blocks within each phase connect at the specified seams; phase switching uses the menu because no connection between the two zones was supplied.

WASD / arrows steer, accelerate, brake and reverse. Touch controls work in portrait and landscape. Space pauses, E collects or delivers when stopped near the order, H hides the HUD. Cash updates after a delivery. The overview camera supports dragging and zooming. Reference switches to the supplied player camera and overlays the corresponding reference image with an opacity control. Other reference cameras are in Settings.

## Reference fidelity

The ZIPs contain images and specifications, not finished meshes, calibrated camera parameters or texture atlases. Their own quality reports document differences among generated views. The source JSON stays unmodified. Runtime calibration adjusts the waterfront storefronts, shoreline, pier, palms, parked vehicles and player cameras to the supplied player image; the waterfront calibration is shared across its blocks. Heritage/market shop setbacks and the urban junction have separate fixed image calibrations. This is a playable authored reconstruction, **not a pixel-identical recreation**. Foliage, windows, furniture, materials, character and vehicle silhouettes still differ visibly from the references. Phase 2's more natural material appearance especially needs further art work to meet the reference images.

The scene renderer retains the road connections (including the tapered market approach), shortcuts, promenade, pier, two fishing nets, chapel, bus stop and bridge. Bridge and water clearance use the calibrated geometry. Collision includes buildings, compound walls, seawalls, poles and parked vehicles. Vehicles keep their authored positions in riding and reference views and participate in collision. Pedestrians animate while riding and use fixed poses in reference views. Decorative planting is added inside fixed lots; no extra main buildings are invented. Future edge connections remain open boundaries, not invented playable districts.

The model and wardrobe review pages remain available. Their source and the vehicle/character assets were reused from the repository's last commit before `src/` was removed. The previous procedural village world is not part of this rebuild.

## Verification

```sh
npm run check
npm run build
npx playwright install chromium
npm run preview -- --port 4173
# In another terminal:
npm run check:browser
```

For a system Chromium, use `CHROMIUM_PATH=/usr/bin/chromium npm run check:browser`. `PREVIEW_URL` selects another preview or deployed URL. `check:maps` and `check:maps:browser` are compatible aliases for the same checks.

The geometry check covers all 33 building footprints, 14 reciprocal road/path seams, camera assets, the tapered road, bridge/water collision, acceleration, reversing and wall stopping. Browser checks exercise both phases and all cameras, drive/pause controls, reference opacity, touch controls, portrait layout and both model review pages. They capture real WebGL renders of each scene's master/player views under `artifacts/scenes/`. Run `node scripts/export-captures.mjs` after a successful full capture check to refresh the review gallery at `phase1-comparison/` with those actual captures; legacy SVG placeholders are not used as game renders.

`src/layout.js` maps and validates reference coordinates and controls driving. `src/scenes.js` builds the fixed geometry and batches static objects. `src/main.js` handles cameras, animation, orders and controls. `src/water.js` shades the continuous sea with ripples and sky reflections. Original scene specifications and optimized reference images are in `public/scenes/`. See [reference provenance and limits](docs/scene-reconstruction.md).

Main-branch deployment retains the existing GitHub Pages workflow. Local edits do not deploy until pushed.
