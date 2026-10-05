# Real Kerala locations

Open **Explore Kerala → Play real maps** in the village game. The separate real-map mode provides the Fort Kochi waterfront. Select any of the four original motorcycle models. Use WASD/arrow keys or hold Accelerate and a steering button together on a phone. Map view shows the full imported road layout; Reset bike returns to the starting road.

Road coordinates, road names, one-way tags, building footprints and mapped water polygons and directed coastlines come from OpenStreetMap. These are compact local snapshots, not entire cities. Elevation, default building heights, colours, trees, people and traffic are illustrative. This game does not provide surveyed terrain, live traffic or navigation.

The official OSM API supplies the data. To refresh the Kochi snapshot, run `python3 scripts/import-real-maps.py`, then rebuild. The runtime loads local JSON and does not require a maps API key. The importer clips geometry to each location's bounds and excludes roads tagged private or inaccessible to motor vehicles. Directed coastline chains are joined before clipping, with land represented as holes in the harbour surface. This snapshot covers 76.2375–76.2475° E and 9.9625–9.9725° N (about 1.10 × 1.11 km), with 106 road features and 902 building footprints. It is not a general importer for every OSM multipolygon relation.

The visible map credit links to OpenStreetMap's copyright page. The map exposes its downloadable JSON database under ODbL 1.0; see [the map licence](../public/maps/LICENSE.txt). No proprietary map tiles or manufacturer vehicle assets are included.

Other adventurous locations worth adding next:

- **Athirappilly:** waterfalls and winding forest approach roads.
- **Vagamon:** hill roads, meadows and mist.
- **Wayanad:** forest routes and mountain climbs.
- **Idukki:** mountain roads and reservoir scenery.

These four suggestions link to OSM from the game's adventure menu; they are not playable snapshots yet.

Validate geographic snapshots with `node scripts/check-real-map.mjs`. After building and starting the preview server, run `node scripts/check-real-map-browser.mjs` to check Kochi, model selection, attribution and simultaneous mobile acceleration/steering.

## Delivery gameplay and scene detail

The real-map mode now includes timed meal orders, destination pins on the minimap and in the world, food condition, rewards, and repeat deliveries. Hold Accelerate to start the timer, ride to within 10 metres of the marked stop, then press **Deliver meal**. A completed or expired order offers **Next order**. Reset bike returns to the starting street while keeping the current delivery's timer and cash. Cash is session-only in this mode.

Low-rise buildings with convex footprints receive original terracotta hip roofs, timber fascias, exposed rafters, ridge caps and gutters. Roof tile rows follow each roof face, with relief shading and deeper eaves. Street-facing walls have timber window shutters, paneled entrance doors, downpipes, window sunshades and surface wiring. Homes and selected shops have distinct frontages: stepped verandas, pots, courtyard surfaces, open compound-wall entrances and occasional outside stairs; shops add local signs, brass vessels on timber shelves and hanging lamps. Ground details use checked road setbacks and collision footprints. The art pass draws on [real Kochi and Kerala photographs](kochi-photo-references.md) while retaining the warm game palette. Tall buildings and irregular concave footprints retain flat roofs. These details are illustrative Kerala architecture; mapped road positions, building footprints and specified wall heights stay intact. Textured plaster, window frames, sills and balconies dress the façades. The street environment adds textured asphalt and paving, dashed markings, tropical palms, understory and lamps. Pedestrians walk short clear roadside paths and pause to turn.

The mode uses the village game's rendering passes, with contact shading, reflections and sunlight shadows. **Detail on/off** switches contact shading and render resolution for phones. High pixel-density devices default to Detail off. Scenery is instanced to keep city-scale detail from creating one draw call per window or leaf. Tree trunks and lamps participate in bike collision checks.

Open land around the imported streets now receives up to 240 illustrative neighbourhood lots: smaller tiled homes with yards and open wall entrances, tea/fruit stalls with counters, and shaded gardens. Roadside shade trees and banana planting also dress existing setbacks, keeping entrance corridors open. Twelve selected stalls have rigged vendors. These additions prioritise the starting neighbourhood and fill gaps in the snapshot's urban fabric; they are original scenery, not surveyed OSM buildings or new real-world landmarks. Full lot footprints are checked against roads, water, mapped buildings, existing tree trunks and frontages, and against one another. House bodies and stall counters/back walls use oriented collision boxes. Native Three.js instancing shares house roofs, wall parts and foliage rather than adding a draw call per prop.

## Fort Kochi waterfront

The fictional two-storey Mud Meals restaurant occupies a checked clear lot by River Road. Its tiled roof, timber veranda, shutters, balcony, open takeaway counter, Malayalam/English sign and vendors are original authored scenery. A paved shore-side plaza has four occupied fruit stalls. A short dirt service passage remains freely traversable; it does not lock the rider to a navigation path.

The stone quay and railings follow the imported coast. Four Chinese fishing-net structures sit by the mapped net landmark; St Francis Church receives an illustrative heritage facade on its actual footprint. The mapped Junkar jetty location anchors the original timber jetty and ferry scenery. Boats remain in water, while distant cranes and buildings provide scenic depth. The restaurant, stalls, facades, net arrangement and boats are illustrative, not surveyed reconstructions.

Delivery bays on Tower Road, Bastian Street and Bellar Road serve a market customer, heritage home and jetty service area. The route line follows the directed road network and respects one-way tags; same-street approaches project to the road rather than detouring via its endpoints. Bays are outside the road centre and have checked full-bike clearance. Traffic and pedestrians can still occupy nearby space during play.

The raised follow camera and compact HUD work in portrait and landscape. **Pause** stops simulation and continuous rendering; changes to paused settings redraw once. The shared 30/60 FPS controls and rendering changes also apply to the village game. See [performance](rendering-performance.md) and [the rebuild record](kochi-waterfront-rebuild-plan.md). Munnar and Thekkady remain removed; Ernakulam, the metro and additional harbour districts are future expansion ideas.
