# Asset Pipeline

MudMeals now treats procedural geometry as fallback art only.

## Runtime path

1. Add production GLB files under `public/assets/models/`.
2. Keep names/paths aligned with `src/assets/AssetRegistry.ts`.
3. Request models through `AssetManager`.
4. Use `instantiate()` for unique animated/skinned objects.
5. Use `replaceFallback()` while migrating existing procedural scene pieces.
6. Keep gameplay/collision data independent from visual meshes.

Missing files do **not** break gameplay. `AssetManager` logs the missing asset and retains the procedural fallback.

## Art requirements

Production assets should use:
- GLB / glTF 2.0
- physically based materials
- albedo/base-color, normal, roughness and AO where they materially improve quality
- sensible mesh pivots and real-world-ish scale
- LOD-ready topology
- compressed textures (KTX2 target)
- Meshopt or Draco where useful
- shared materials/textures for repeated environment kits

## Suggested folders

```
public/assets/
  models/
    player/
    vehicles/
    world/
    vegetation/
    props/
  textures/
    roads/
    architecture/
    vegetation/
    decals/
    ui/
```

## Replacement priority

1. Motorcycle + rider
2. Hero restaurant + destination house
3. Auto-rickshaw + bus + compact car
4. Coconut palms / banana plants
5. Kerala house kit
6. Bridge / canal edge kit
7. Utility poles, wires, roadside props
8. Canoes / houseboats / dense set dressing

Do not remove procedural fallbacks until the corresponding production asset is tested in the production build.
