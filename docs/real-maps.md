# Kochi image-inspired game world

Tap **Kochi map** in the village game to open the waterfront. The existing `real-map.html` URL remains compatible with saved links; it now loads an original fictional layout, not real-world map data.

Only [the images shared by the user](kochi-image-references.md) guide the composition and palette. The imported road/building database, geographic importer, external photo board and generated concept references were removed. There are no external map-service requests, geographic coordinates, real-world street identities or third-party map credits in this mode.

## Layout and gameplay

The project-authored metre layout includes winding residential and market streets, a sweeping waterfront boulevard, a tiled Mud Meals restaurant, an occupied shore market, a fictional waterfront chapel, fishing nets, promenade, jetty and boats. Dense tiled houses, yards, stalls and layered planting follow the shared images. Background harbour silhouettes remain original scenery. The shoreline follows the waterfront bends. The street network is hand-composed around the image composition: branching heritage lanes, an angled market crescent, a south-bank garden neighbourhood and three canal crossings replace the repeated grid. Short bridge spans stay straight. Shared junctions and split incidental crossings keep the delivery network connected. Building lots and scenery are checked against the curved road corridors. The layout is designed for play rather than reproducing Kochi geography.

**Market Street**, **Heritage Lane** and **Jetty Road** connect three delivery bays. Use WASD/arrows or hold Accelerate with a steering button on a phone. Timed orders, food condition, cash rewards, collision checks and free driving remain. Ride within 10 metres of the customer and tap **Deliver meal**; completed or expired orders offer **Next order**. Reset bike returns to the restaurant while retaining the current order and cash. Cash is session-only.

The waterfront shares the original village HUD: brand and delivery card on the left, cash and bank at the top, round minimap, joystick and circular pedals, Orders panel and gear menu. Landscape uses the original 16:9 frame; portrait keeps the visual style and usable phone controls. The gear menu holds bike selection, map view, frame-rate and graphics settings.

## Rebuilding and checks

`node scripts/build-kochi-layout.mjs` deterministically writes the original local layout to `public/maps/kochi.json`. It fetches nothing. [Layout provenance](../public/maps/LICENSE.txt) records the authored source; user images are not bundled map textures.

Run `npm run check:maps` for layout, roof, footprint, water, road clearance and delivery connectivity checks. Build and serve the preview, then run `npm run check:maps:browser` for the rendered world, delivery payments, model selection, collision safety, mobile driving, menu controls and rotated layouts.

The 30 FPS default, optional 60 FPS, hidden/paused suspension, GPU backpressure, vehicle batching and spatial scenery batches remain. Materials, model detail, contact shading and shadows remain at the existing quality setting. Historical [performance measurements](rendering-performance.md) predate this authored-layout replacement and are not benchmarks of the current city. Physical-phone temperature remains unmeasured.
