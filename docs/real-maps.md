# Real Kerala locations

Open **Explore Kerala → Play real maps** in the village game. The separate real-map mode provides Busy Kochi (central Ernakulam), Munnar town and surrounding roads, and Thekkady's Periyar approach. Select a location and any of the four original motorcycle models. Use WASD/arrow keys or hold Accelerate and a steering button together on a phone. Map view shows the full imported road layout; Reset bike returns to the starting road.

Road coordinates, road names, one-way tags, building footprints and mapped water polygons come from OpenStreetMap. These are compact local snapshots, not entire cities. Elevation, default building heights, colours, trees, tea planting, people and traffic are illustrative. This game does not provide surveyed terrain, live traffic or navigation. The forest location uses mapped approach roads rather than routes through the protected wilderness.

The official OSM API supplies the data. To refresh the three snapshots, run `python3 scripts/import-real-maps.py`, then rebuild. The runtime loads local JSON and does not require a maps API key. The importer clips geometry to each location's bounds and excludes roads tagged private or inaccessible to motor vehicles.

The visible map credit links to OpenStreetMap's copyright page. Each location exposes its downloadable JSON database under ODbL 1.0; see [the map licence](../public/maps/LICENSE.txt). No proprietary map tiles or manufacturer vehicle assets are included.

Other adventurous locations worth adding next:

- **Athirappilly:** waterfalls and winding forest approach roads.
- **Vagamon:** hill roads, meadows and mist.
- **Wayanad:** forest routes and mountain climbs.
- **Idukki:** mountain roads and reservoir scenery.

These four suggestions link to OSM from the game's adventure menu; they are not playable snapshots yet.

Validate geographic snapshots with `node scripts/check-real-map.mjs`. After building and starting the preview server, run `node scripts/check-real-map-browser.mjs` to check the three worlds, model selection, attribution and simultaneous mobile acceleration/steering.

## Delivery gameplay and scene detail

The real-map mode now includes timed meal orders, destination pins on the minimap and in the world, food condition, rewards, and repeat deliveries. Hold Accelerate to start the timer, ride to within 10 metres of the marked stop, then press **Deliver meal**. A completed or expired order offers **Next order**. Reset bike returns to the starting street while keeping the current delivery's timer and cash. Cash is session-only in this mode.

Textured plaster façades, window frames and sills, balconies, signs and awnings dress the OSM footprints. Convex low-rise footprints in the hill/forest maps receive pitched tiled roofs. The street environment adds textured asphalt and paving, dashed markings, layered tropical trees, palms, understory, lamps and rocks. Original OSM coordinates remain the basis of the map; decorative shops and mountain scenery are fictional. Pedestrians walk short clear roadside paths and pause to turn.

The mode uses the village game's rendering passes, with contact shading, reflections and sunlight shadows. **Detail on/off** switches contact shading and render resolution for phones. High pixel-density devices default to Detail off. Scenery is instanced to keep city-scale detail from creating one draw call per window or leaf. Tree trunks, lamps and rocks participate in bike collision checks.

## Approved Munnar adventure layout

Munnar now has a 2.6 km paved town circuit plus two fictional off-road routes that reconnect to the original road network:

- **Tea estate loop:** approximately 545 m of dirt trail through contoured tea planting, including a short mud section and an estate cottage delivery stop.
- **Ridge gravel loop:** approximately 696 m climbing through the hillside to a lookout delivery stop.

Gravel, dirt and mud have lower speed limits and traction than asphalt, and travelling over rough surfaces reduces food condition faster. Mud is the slowest section. Traffic uses the original mapped roads. The minimap highlights the main circuit and both trails; the surface label beside the speed readout tells the rider which surface they are on.

The extra hills and trail geometry are game design, not surveyed Munnar terrain. Original OSM roads and footprints keep their coordinates. `public/maps/munnar-adventure.json` holds the authored route controls and road connections. Regenerate it after updating the OSM snapshot with `python3 scripts/plan-munnar-routes.py`; the planner keeps paths clear of buildings and water and attaches their entrances/exits to the connected town road network.

`node scripts/check-munnar-adventure-browser.mjs` checks clear bike collision corridors and connected acceleration on both trails, and saves actual game screenshots. This is the first location built from the approved concept; Kochi and Thekkady's adventure layouts are pending review of Munnar.
