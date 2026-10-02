# Person and autorickshaw rebuild review

Open `review.html` for the isolated Three.js review stage. Drag rotates the camera; the view buttons show the person, face detail, autorickshaw, side view and metre-scale comparison.

The customer now loads `public/review/customer.glb`: a 1.75 m textured human with seven separate meshes (exposed anatomical body, collared cotton shirt, jeans/belt, leather shoes/socks, strand-card hair, eyebrows and anatomical eyes). The clothing has authored construction, UVs, seams, cuffs, pockets, closures, folds and normal maps; it is no longer recoloured body topology. Skin uses an authored UV atlas. The adult male body retains the anatomical eyelids, ears, hands and fingers. Arms are lowered and feet slightly staggered and turned outward. All selected source assets are explicitly CC0; sources and modifications are recorded in `public/review/LICENSE-human.txt`.

Rebuild with Blender 4.0: download the official system-assets CC0 pack linked in the license file, then run `blender --background --python scripts/build-human.py -- /tmp/opencode/makehuman-system.zip`. The script retrieves the version-pinned base and morph, fits the source garment proxies, preserves source UVs, removes covered body faces, subdivides, poses and exports the GLB. This is a static review pose. The user-approved human now also supplies rigged in-game wardrobe variants in `crowd.html`; the high-detail inspection mesh remains separate.

`node scripts/check-prototype-browser.mjs` captures full body, face, front, rear, hands, footwear, auto, scale comparison and mobile landscape renders in Chromium. Set `CAPTURE_PUBLIC=1` to save the actual renders in `public/review/renders/` for publication. Technical checks verify loading, textures, metre scale and console/network errors. They do not establish visual acceptance or an exact match to `public/reference.png`.

Visual iteration corrected the opaque cornea (which initially hid the irises), oversaturated iris colour, light hair colour, thumb/trouser clearance and sock shafts penetrating the denim. The GLB is a high-detail inspection asset (~336k rendered triangles, ~13.5 MB); game LODs, a skeleton, animation and device performance profiling belong to Phase 3 after visual approval. The 900×500 Chromium capture checks landscape framing and review controls, not real-device game performance.

## WebGL startup recovery

Three.js r180 requires WebGL2. A browser reporting `GL_VENDOR = Disabled` and `GL_RENDERER = Disabled` is failing before the GLB loads. The review now catches startup failures, shows recovery instructions and links to explicitly labelled saved Chromium renders; it does not represent those PNGs as a live model. For Chrome/Edge, enable graphics acceleration under Settings → System, fully restart, and inspect `chrome://gpu` / `edge://gpu` if WebGL2 remains unavailable. The site cannot enable a browser-disabled graphics API. `node scripts/check-review-startup.mjs` reproduces this with `--disable-webgl`, verifies no uncaught error or model request, and checks the saved-render links.

The autorickshaw review now shows the original Mud C3 design. It uses a generic three-wheeler layout with metre-scale seating, wheels, suspension and canopy. Its compound-curved front shell, horizontal lamp assemblies, rear quarter panels with wheel openings, engine cover and game badge are project-authored. No manufacturer CAD, downloaded vehicle mesh, real badge, livery or vehicle photographs are bundled. The materials use the existing environment lighting and original canvas grain/badge textures. This is a custom mesh prototype, not a scanned or licensed replica of a commercial vehicle.

These are actual 3D meshes rendered in WebGL, not reference images placed in the scene. The `Render person and autorickshaw prototypes` GitHub workflow checks dimensions and captures Chromium renders. The main game uses the approved human wardrobe variants. Its vehicles retain the previous models pending review of the Mud C3 prototype.

## October 2 review continuation

The unfinished textured draft was present in the checkout and preserved. The hair now uses the CC0 `short02` source with its authored strand layering intact; the previous nearest-scalp compression was removed because it folded cards into one another and exposed bright gaps. Eye whites receive a subtle warm tint. The static review stage renders on camera movement and resize rather than redrawing an unchanged model continuously.

The customer was subsequently approved by the user; its rigged wardrobe variants are now integrated into world NPCs. The supplied reference establishes the world composition and art direction, but does not show enough facial detail to validate a close-up likeness. No claim of reference equivalence is made.

## October 2 vehicle design review

The first Mud C3 render exposed front quarter panels that did not meet the nose and oversized projecting lamps. The quarter surfaces now share the nose profile exactly; lamp depth and angle follow the curved front. The review includes front, side, rear, cabin and person/vehicle comparison views. The main game's vehicle fleet remains unchanged until appearance approval, following the requested prototype-first workflow.

Verified with `node scripts/check-prototypes.mjs`, production Vite build and hardware Chromium prototype checks. Captures are real Three.js renders in `artifacts/prototypes/`. The recorded body is approximately 2.64 m long and 1.69 m high; width including mirrors is 1.68 m. These checks establish loading, geometry and framing, not visual acceptance or legal clearance.

## Fleet continuation

`src/prototypes/vehicles.js` adds the fictional Mud C4 compact car, V4 crew van, M9 local bus and D2 delivery scooter. The review vehicle selector offers each model and a common fleet comparison beside the approved 1.75 m human; a second selector changes the camera angle. Direct links support `?view=car`, `van`, `bus`, `bike` and `fleet`, with `-front`, `-side` and `-rear` suffixes for individual vehicles.

These models are project-authored indexed surfaces, glazing, structural members and interior components, with original canvas lettering and cloth grain. They use generic construction and fictional Mud branding. No third-party vehicle mesh, manufacturer CAD, photographs or real operator livery is included. This is a record of asset provenance, not a legal clearance claim.

Body design dimensions (length × width × height in metres): car 4.05 × 1.72 × 1.50; van 4.45 × 1.78 × 2.03; bus 9.70 × 2.50 × 3.10; scooter approximately 2.00 × 0.75 × 1.25. Mirrors and lamp fixtures extend beyond body dimensions. Interiors include seats, right-hand steering, dashboard and van cargo space; the bus has passenger seating, handrails and a front passenger door with steps. The scooter has a separate saddle, footboard, fork, suspension, exhaust and delivery cargo box.

Actual browser iteration corrected window gasket overshoot, body/endcap discontinuities, roof/glazing gaps, shadow banding, saddle overlap and clipped destination lettering. Geometry checks verify finite vertices, ground clearance, height, wheel count and a per-model geometry budget. Hardware Chromium captures all four models from multiple angles plus the 900 × 500 landscape layout and tests the vehicle/angle controls. These establish rendering and interface behavior, not visual approval or physical mobile performance. No fleet replacement is made in the game during this review phase.

## Kerala vehicle direction

The generic sedan and large crew van were revised following the user's request for vehicles seen in Kerala. The C4 now uses a short-bonnet, five-door hatchback layout with an upright tailgate, rear wiper and broad rear quarter pillars. Its body dimensions are 3.65 × 1.62 × 1.54 m. The V4 is a compact sliding-door passenger van, 3.78 × 1.60 × 1.87 m, with a shorter wheelbase and smaller window openings. These supersede the earlier car/van dimensions above.

The M9 now has red-and-cream ordinary-service proportions, a solid header above the passenger windows, Malayalam Kochi–Aluva route lettering and fictional Mud Local branding. The C3 has a black rear body and yellow nose below its black canopy. The D2 uses a broader handlebar headlamp cowl, fuller engine cover and footboard appropriate to a commuter scooter adapted for deliveries. Manufacturer badges and existing operator names are absent.

Reference pages used for vehicle classes and construction cues (photographs and manufacturer assets are not bundled in the project):

- [Maruti Suzuki Alto K10](https://www.marutisuzuki.com/arena/alto-k10), compact Indian hatchback packaging.
- [Maruti Suzuki Eeco](https://www.marutisuzuki.com/arena/eeco), compact passenger van packaging.
- [KSRTC ordinary-service bus photograph](https://commons.wikimedia.org/wiki/File:KSRTC_Ordinary_Service_Bus.jpg), by Outlander07, CC BY-SA 3.0; reviewed for local bus proportions and palette.
- [Alappuzha–Erattakulangara private bus photograph](https://commons.wikimedia.org/wiki/File:Alappuzha_-_Erattakulangara_bus_-_Aradhana.jpg), reviewed for regional window/route-board construction.

The resulting meshes are original stylized prototypes, not exact commercial model replicas. This revision does not establish reference-level polish or visual acceptance. The game still retains its prior fleet until the revised models are approved, as required by the user's workflow. Verified geometry, production build, Chromium views and landscape controls; physical mobile performance remains unmeasured.

## Modern fleet revision

Following the request for modern vehicles, the hatchback now has a wider 3.85 × 1.72 × 1.54 m body, higher shoulder line, compound bonnet, rounded nose and bumper corners, contrasting roof and rear pillars, recessed grille, projector-style lamp modules, slim daytime-light elements, open five-spoke alloy wheels, rear spoiler and integrated rear lighting/bumper. The former compact cab-over van is now a 4.45 × 1.80 × 1.72 m three-row MPV using the same formed body construction. The review selector labels it MPV; the existing `view=van` URL remains supported.

The city bus uses fictional white/teal styling, a wider continuous dark window band, modern front light modules and roof-mounted equipment. Its body remains approximately 9.70 × 2.50 × 3.10 m, with roof equipment reaching 3.20 m. The scooter has a slimmer front/rear light design and open alloy wheels. The black-and-yellow auto retains its local three-wheeler construction with an added slim light element in each lamp housing.

Contemporary construction references consulted: [Maruti Suzuki Swift design](https://www.marutisuzuki.com/arena/swift) and the [KSRTC-SWIFT electric-bus tender](https://www.keralartc.com/storage/downloads/Tendernotice_1%2852%29.pdf). These inform vehicle category and general detail choices; no claim is made that the fictional prototypes reproduce either vehicle. Manufacturer assets, badges and real operator liveries are not bundled.

Browser iteration corrected roof material backface culling, front cap/bonnet width mismatch and grille surfaces being occluded by the rounded body. Screenshots include front/side/rear angles, individual models, the full fleet and landscape controls. Geometry checks and the production build pass. Appearance is still awaiting approval; world vehicles and their physics were not replaced in this revision.
