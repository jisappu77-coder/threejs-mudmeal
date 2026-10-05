# Kochi waterfront direction

The current direction follows only [the images shared by the user](kochi-image-references.md). The user requested removal of real-world map references after the waterfront HUD was matched to the original game.

## Current implementation

- Hand-composed local metre layout: a sweeping peninsula waterfront, branching heritage lanes, a market crescent, angled neighbourhood junctions and a canal separating the southern gardens. Shared nodes and split crossings keep navigation connected; no imported geographic data or external photo references.
- The latest street references supersede `72849.jpg`: cafés now sit inland, opposite a continuous paved promenade and harbour. The authored shoreline follows the road at a 17-metre offset instead of leaving a large lawn. Dining tables sit in front of the restaurant; the public stalls follow the curve behind the starting view.
- Close café frontages have wooden balconies, shutters, striped awnings and flowering vines. Paired moulded white church towers, arched openings, lanterns, black/cream curb stones, yellow road edges and translucent fishing-net fabric establish the street composition.
- Fictional chapel, fishing-net promenade, jetty, boats and distant harbour silhouettes composed for a playable scene rather than actual monument positions.
- A church-side canal and waterfront bridge bring the northern waterway into the reference composition. Three connected delivery destinations, four driveable canal bridges with railings, full-bike collision checks and a traversable dirt service passage.
- The matched Mud Meals HUD remains. Grass, roof, plaster and water colours now follow the more natural tones in the supplied waterfront image. The default camera is a close third-person street view. Settings also offer an elevated ride camera; the existing full map toggle remains.
- Large two-storey street frontages and a second row of courtyard houses replace the detached-house spacing. Paved compounds, a larger restaurant and connected terrace/quay reduce uninterrupted lawn. Transparent leaf clusters with original procedural textures replace opaque tree crowns, with the existing 260 shade-tree cap retained. The first six traffic vehicles start on the waterfront instead of being scattered inland.
- Existing rendering optimizations and quality controls retained. The original layout is deterministic and can be rebuilt without network access.

The prior geographic source and generated design concepts are no longer active references. The supplied aerial labels are composition cues. Munnar and Thekkady remain removed. Modern districts, metro and port gameplay can be developed later using the user's supplied imagery; they are not additional implemented maps. The canal bridges belong to the existing Kochi map.

Runtime captures from `npm run check:maps:browser` establish what the game actually renders. Physical-phone heat and sustained frame rates remain unmeasured.

For repeatable 1280 × 720 street/elevated captures and promenade clearance assertions, run `PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright node scripts/capture-kochi-reference.mjs` against the built preview. The captures live under `artifacts/real-map/refinement-*.png`; `refinement-audit.json` records submitted geometry and the frontage/road audit. These are actual game captures, not generated concept images.

The street composition is closer to the supplied references, but the procedural buildings, boats, palms and rider still look stylized. This revision does not establish photographic or pixel-exact fidelity. The wide reference images also show districts outside the current playable waterfront; the implementation retains the existing 22-road game world.
