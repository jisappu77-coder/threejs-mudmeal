# Mud Meals — Kochi Outskirts

A landscape Three.js delivery scene inspired by the supplied Kerala reference: tiled roofs, curved roads, traffic, palms, rice fields, a canal and bridge, with a delivery HUD and animated riders. The scene uses detailed procedural geometry and textured materials. It remains a visual recreation and interactive prototype; it is not a pixel-identical reproduction or a complete delivery game.

**Website:** https://jisappu77-coder.github.io/threejs-mudmeal/

## Run locally

Requires Node.js 22 or newer.

```sh
npm ci
npm run dev
```

Arrow keys or WASD steer; accelerate/brake buttons control speed. Space pauses. The gear menu offers free camera, reset, the reference image, HUD toggle and fullscreen. Press H to restore a hidden HUD. Portrait phones show a landscape prompt. WebGL 2 is required; unsupported browsers show an explanatory message.

## Checks and deployment

```sh
npm run check
npm run build
npx playwright install chromium
npm run preview
# In another terminal:
npm run check:browser
```

The single GitHub Actions workflow checks scene construction, builds the website, and tests the production build in Chromium. Browser screenshots are attached to the workflow run. Successful pushes to main deploy dist/ to GitHub Pages; pull requests run checks without deploying. Pages uses the repository's existing GitHub Actions configuration.

src/scene.js contains the scene and interaction; src/graphics.js configures ambient occlusion and rendering; src/style.css provides the responsive HUD. public/ contains the supplied reference and food image. Design notes remain in docs/. Earlier placeholder models and duplicated workflows were removed; their history remains in Git.

## Extended Kerala world

The scene now connects the original market to nine additional procedural districts: backwater tea shop, paddy trails, village, port, ferry landing, lighthouse coast, Fort Kochi market, hill road and viewpoint. Open **Settings → Explore Kerala** to travel to a district or choose clear day, golden hour or rainy night. Accelerate tours the continuous road; steering adjusts the rider’s lane. The perspective follow camera, camera sliders and landscape layout remain available.

These are modeled environments inspired by the references, not photorealistic reproductions. The ferry, port and houseboats are scenery; boarding, jobs in each district and free off-road driving are not implemented. Geometry is instanced in district batches to permit view culling. GitHub Actions tests world travel, driving, weather and responsive layout in Chromium, then repeats the checks against GitHub Pages and uploads screenshots.

## Original image composition

The default camera now uses a long lens and a fixed isometric orientation to frame the original Kochi scene. **Camera settings → Follow rider** restores the driving camera. The reference comparison overlay includes an opacity slider and **Restore matching view**, allowing direct comparison against the provided image. Hotel placement, storefront size, traffic, foliage/road/water colours, rider scale and HUD palm illustration are adjusted toward that original composition. This is a modeled interpretation, not a pixel-identical reproduction of the image.

## Living world and placement checks

All 27 customers have checked walking routes. Seated diners periodically stand, walk a short circuit, and return to their seats; standing customers patrol their shopfronts and greet a nearby rider. Limbs, heads, and breathing animate independently. Palms, banana leaves, shrubs, and rice sway with shared wind and matching shadow deformation; rainy weather strengthens the gusts.

35 traffic vehicles and rival bikes follow the two road lanes, turn with road curves, rotate their wheels, and brake for traffic and the player. The rider stops at occupied vehicle space. Vehicles continue around the closed circuit without boundary respawns. This is lane-based traffic, not a general vehicle physics engine.

Buildings, furniture, water, and road widths govern procedural vegetation and pedestrian placement. Scene checks audit every walking route, original and extended building clearance, and vehicle intersections throughout a simulated minute. Chromium captures all districts plus walking and greeting close-ups, then repeats the checks on the deployed site.

### Road and asset rebuild

The town road and district connector now form one paved closed circuit. The turquoise navigation guide and traffic lanes derive from that circuit; vehicles cross its seam continuously. The canal bridge is a separate narrow shortcut. The initial delivery marker and order text now point to a roadside home reachable on the circuit. Junction kerbs are opened, and the original rice plots and fences are clipped outside the road corridor. Automated checks cover loop position/tangent continuity, centerline self-intersection and vehicle wrap distance; Chromium captures a whole-map overhead view.

People use a sculpted face surface, fitted facial details, swept hair and articulated clothing/limbs. Autorickshaws have a formed yellow nose, a single raked windshield, open passenger entrances, stitched canvas canopy, bench seating, a seated driver and three wheels. Dimensions and proportions are informed by [Bajaj RE specifications](https://www.bajajauto.com/three-wheelers/re/specifications). The map remains a compressed fictional Kerala-inspired world, not a surveyed or imported real-world road map; [Kochi on OpenStreetMap](https://www.openstreetmap.org/#map=13/9.966/76.260) is a geographic reference.

### Consistent metre scale

One scene unit is one metre. Representative target body dimensions (length × width × height) are auto 2.635 × 1.300 × 1.700 m, compact car 3.530 × 1.490 × 1.520 m, van 3.675 × 1.475 × 1.825 m, and bus 10.934 × 2.600 × 3.250 m. Pedestrians are approximately 1.73 m tall; the motorcycle is approximately 2.09 m long with an adult-sized seated rider. Mirrors and delivery cargo are included in measured collision footprints. Wheels retain their round shape through body calibration and rotation. The bus height is an authored body target; these remain representative procedural vehicles rather than exact manufacturer replicas.

Reference specifications: [Bajaj RE](https://www.bajajauto.com/three-wheelers/re/specifications), [Alto K10](https://www.marutisuzuki.com/arena/alto-k10), [Eeco](https://www.marutisuzuki.com/arena/eeco), [Viking](https://www.ashokleyland.com/in/buses/brands/viking/specification), and [Hunter 350](https://www.royalenfield.com/content/dam/open-pdf/royal-enfield-hunter-350-technical-specifications-new.pdf). Chromium captures an orthographic lineup on a shared metre grid to verify the relative scale.

### Object realism revision

The object review identified flat teal glass, rounded toy-like cabins and smooth skin/cloth. Materials now combine the original reference's vibrant greens, terracotta roofs, golden daylight and turquoise water with reflective glass, separate paint/rubber/canvas finishes, woven clothing, fine skin variation and weathered plaster. The main game and geographic maps use Three.js Neutral tone mapping to preserve material colours. Car and van cabins use matching lofted body/window surfaces; wheel openings are cut into the metal body profile. Scene checks verify every window sits outside its opaque cabin and preserve the metre-scale dimensions and circular rolling wheels. Chromium produces isolated studio renders of every vehicle and both person poses, plus the world and scale lineup.

These remain procedural game assets; this revision moves them toward natural materials and forms but does not make them photorealistic scanned models. The generated photographic sheet is an art-direction reference, not the rendered game.

## NPC wardrobe and driving

The approved textured human now supplies four rigged NPC clothing/hair styles in the game. Inspect them at `crowd.html`. Driving allows free steering onto side roads and open ground, with hill resistance, wet braking, corner speed limits and predictive traffic braking. The default camera follows the rider. See [implementation and limitations](docs/driving-and-crowd.md).

The delivery bike offers four original, unbranded motorcycle/scooter styles under **Explore Kerala → Bike style**. Model provenance and naming are documented in [vehicle models](docs/vehicle-models.md).

Real Kerala locations: **Explore Kerala → Play real maps** opens the Fort Kochi waterfront, using attributed OpenStreetMap roads and footprints with detailed stylized scenery, walking pedestrians and timed meal deliveries. The waterfront adds the original Mud Meals restaurant, an occupied shore market, Chinese fishing nets, a jetty, boats and three connected delivery bays. Use **30 FPS** (default) for less GPU work or select **60 FPS**. **Detail on/off** still controls contact shading and resolution. See [location details and data licensing](docs/real-maps.md).

## Rendering load

Both game modes now cap rendering at 30 FPS by default, retain a 60 FPS option, stop rendering in hidden tabs and avoid continuous redraws while paused. GPU backpressure prevents queued frames. Rigid vehicle batching, shared materials, spatial scenery batches and camera-aware actor culling retain the visible models, texture detail, contact shading and shadow quality. Off-screen NPC movement continues while unnecessary rig animation stops. Sharp graphics uses native display resolution up to 2× pixel density, without forcing supersampling on 1× screens.

See [rendering measurements and limitations](docs/rendering-performance.md). Browser measurements cannot certify phone temperature or sustained hardware performance.

For the geographic waterfront checks, run `npm run check:maps` and, with the built preview running, `npm run check:maps:browser`.
