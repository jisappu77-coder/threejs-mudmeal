# Kochi waterfront direction

The current direction follows only [the images shared by the user](kochi-image-references.md). The user requested removal of real-world map references after the waterfront HUD was matched to the original game.

## Current implementation

- Original local metre layout with connected waterfront, market and neighbourhood streets; no imported geographic data or external photo references.
- Restaurant, occupied shore stalls, deep verandas, tiled roofs, shutters, warm plaster, palms and layered planting inspired by `72849.jpg` and the supplied city images.
- Fictional chapel, fishing-net promenade, jetty, boats and distant harbour silhouettes composed for a playable scene rather than actual monument positions.
- Three connected delivery destinations, full-bike collision checks and a traversable dirt service passage.
- Original Mud Meals palette and matched HUD from the user's original game image.
- Existing rendering optimizations and quality controls retained. The original layout is deterministic and can be rebuilt without network access.

The prior geographic source and generated design concepts are no longer active references. The supplied aerial labels are composition cues. Munnar and Thekkady remain removed. Modern districts, metro, port and bridge gameplay can be developed later using the user's supplied imagery; they are not additional implemented maps.

Runtime captures from `npm run check:maps:browser` establish what the game actually renders. Physical-phone heat and sustained frame rates remain unmeasured.
