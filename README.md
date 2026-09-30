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

35 traffic vehicles and rival bikes follow the two road lanes, turn with road curves, rotate their wheels, and brake for traffic and the player. The rider stops at occupied vehicle space. Vehicles wait at road boundaries while the rider is nearby. This is lane-based traffic, not a general vehicle physics engine.

Buildings, furniture, water, and road widths govern procedural vegetation and pedestrian placement. Scene checks audit every walking route, original and extended building clearance, and vehicle intersections throughout a simulated minute. Chromium captures all districts plus walking and greeting close-ups, then repeats the checks on the deployed site.

### Road and asset rebuild

The town road and district connector now form one paved closed circuit. Rider navigation and traffic lanes derive from that circuit; vehicles cross its seam continuously. The canal bridge is a separate narrow shortcut. Junction kerbs are opened, and the original rice plots and fences are clipped outside the road corridor. Automated checks cover loop position/tangent continuity, centerline self-intersection and vehicle wrap distance; Chromium captures a whole-map overhead view.

People use a sculpted face surface, fitted facial details, swept hair and articulated clothing/limbs. Autorickshaws have a formed yellow nose, a single raked windshield, open passenger entrances, stitched canvas canopy, bench seating, a seated driver and three wheels. Dimensions and proportions are informed by [Bajaj RE specifications](https://www.bajajauto.com/three-wheelers/re/specifications). The map remains a compressed fictional Kerala-inspired world, not a surveyed or imported real-world road map; [Kochi on OpenStreetMap](https://www.openstreetmap.org/#map=13/9.966/76.260) is a geographic reference.
