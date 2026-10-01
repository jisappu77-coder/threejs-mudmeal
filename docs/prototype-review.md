# Person and autorickshaw rebuild review

Open `review.html` for the isolated Three.js review stage. Drag rotates the camera; the view buttons show the person, face detail, autorickshaw, side view and metre-scale comparison.

The customer now loads `public/review/customer.glb`: a 1.75 m textured human with seven separate meshes (exposed anatomical body, collared cotton shirt, jeans/belt, leather shoes/socks, strand-card hair, eyebrows and anatomical eyes). The clothing has authored construction, UVs, seams, cuffs, pockets, closures, folds and normal maps; it is no longer recoloured body topology. Skin uses an authored UV atlas. The adult male body retains the anatomical eyelids, ears, hands and fingers. Arms are lowered and feet slightly staggered and turned outward. All selected source assets are explicitly CC0; sources and modifications are recorded in `public/review/LICENSE-human.txt`.

Rebuild with Blender 4.0: download the official system-assets CC0 pack linked in the license file, then run `blender --background --python scripts/build-human.py -- /tmp/opencode/makehuman-system.zip`. The script retrieves the version-pinned base and morph, fits the source garment proxies, preserves source UVs, removes covered body faces, subdivides, poses and exports the GLB. This is a static review pose; rigging and animation remain Phase 3 work following appearance approval.

`node scripts/check-prototype-browser.mjs` captures full body, face, front, rear, hands, footwear, auto, scale comparison and mobile landscape renders in Chromium. Set `CAPTURE_PUBLIC=1` to save the actual renders in `public/review/renders/` for publication. Technical checks verify loading, textures, metre scale and console/network errors. They do not establish visual acceptance or an exact match to `public/reference.png`.

Visual iteration corrected the opaque cornea (which initially hid the irises), oversaturated iris colour, light hair colour, thumb/trouser clearance and sock shafts penetrating the denim. The GLB is a high-detail inspection asset (~336k rendered triangles, ~13.5 MB); game LODs, a skeleton, animation and device performance profiling belong to Phase 3 after visual approval. The 900×500 Chromium capture checks landscape framing and review controls, not real-device game performance.

## WebGL startup recovery

Three.js r180 requires WebGL2. A browser reporting `GL_VENDOR = Disabled` and `GL_RENDERER = Disabled` is failing before the GLB loads. The review now catches startup failures, shows recovery instructions and links to explicitly labelled saved Chromium renders; it does not represent those PNGs as a live model. For Chrome/Edge, enable graphics acceleration under Settings → System, fully restart, and inspect `chrome://gpu` / `edge://gpu` if WebGL2 remains unavailable. The site cannot enable a browser-disabled graphics API. `node scripts/check-review-startup.mjs` reproduces this with `--disable-webgl`, verifies no uncaught error or model request, and checks the saved-render links.

The autorickshaw is independently modeled in metres with curved pressed front panels, narrow window seals and roof supports, recessed reflector/lens headlights, a curved canopy with sewn seams, open passenger entrances, bench and driver seats, formed mudguards and three detailed wheels. It represents a Bajaj RE-inspired Kerala auto, not an exact licensed replica.

These are actual 3D meshes rendered in WebGL, not reference images placed in the scene. The `Render person and autorickshaw prototypes` GitHub workflow checks dimensions and captures Chromium renders. The main game continues to use the previously deployed assets pending visual review of these two replacements.

## October 2 review continuation

The unfinished textured draft was present in the checkout and preserved. The hair now uses the CC0 `short02` source with its authored strand layering intact; the previous nearest-scalp compression was removed because it folded cards into one another and exposed bright gaps. Eye whites receive a subtle warm tint. The static review stage renders on camera movement and resize rather than redrawing an unchanged model continuously.

This remains an unapproved representative customer, separate from world NPCs. The supplied reference establishes the world composition and art direction, but does not show enough facial detail to validate a close-up likeness. No claim of reference equivalence is made.
