# Kochi waterfront direction

The current direction follows only [the images shared by the user](kochi-image-references.md). The user requested removal of real-world map references after the waterfront HUD was matched to the original game.

## Current implementation

- Hand-composed local metre layout: a sweeping peninsula waterfront, branching heritage lanes, a market crescent, angled neighbourhood junctions and a canal separating the southern gardens. Shared nodes and split crossings keep navigation connected; no imported geographic data or external photo references.
- Waterside restaurant and planted dining terrace, compact occupied street market, arched white chapel and bell tower farther along the quay, fishing nets and foreground houseboat follow the composition of `72849.jpg`. Dense shade trees, palms, verandas and weathered tile/plaster detail fill the gardens and streets.
- Fictional chapel, fishing-net promenade, jetty, boats and distant harbour silhouettes composed for a playable scene rather than actual monument positions.
- A church-side canal and waterfront bridge bring the northern waterway into the reference composition. Three connected delivery destinations, four driveable canal bridges with railings, full-bike collision checks and a traversable dirt service passage.
- The matched Mud Meals HUD remains. Grass, roof, plaster and water colours now follow the more natural tones in the supplied waterfront image. A narrower 42-degree field of view and lower oblique camera frame the restaurant and quay at the scale of the reference.
- Large two-storey street frontages and a second row of courtyard houses replace the detached-house spacing. Paved compounds, a larger restaurant and connected terrace/quay reduce uninterrupted lawn. Layered textured tree crowns replace flat leaf discs, with the existing 260 shade-tree cap retained. The first six traffic vehicles start on the waterfront instead of being scattered inland.
- Existing rendering optimizations and quality controls retained. The original layout is deterministic and can be rebuilt without network access.

The prior geographic source and generated design concepts are no longer active references. The supplied aerial labels are composition cues. Munnar and Thekkady remain removed. Modern districts, metro and port gameplay can be developed later using the user's supplied imagery; they are not additional implemented maps. The canal bridges belong to the existing Kochi map.

Runtime captures from `npm run check:maps:browser` establish what the game actually renders. Physical-phone heat and sustained frame rates remain unmeasured.
