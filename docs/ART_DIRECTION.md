# Art Direction

## Visual target
The supplied Mud Meals reference image is the primary visual acceptance target.

Use only [the images shared by the user](kochi-image-references.md) for layout, building construction, frontage, props, palette and presentation. Do not consult external maps, satellite imagery, Google Images, tourism photos or generated concept boards. Author original playable arrangements from the supplied compositions.

The goal is a premium stylized 3D scene with:
- dense Kerala-inspired roadside composition
- high-detail authored GLB assets
- believable but vibrant PBR materials
- red tiled roofs, painted plaster, tropical vegetation, turquoise backwater
- strong contact/ambient shading
- warm sunlight with cool environmental fill
- cinematic atmospheric depth
- polished mobile-game readability

## Graphics-first rule
Graphics is the first project gate. Gameplay/system expansion is paused until the hero scene is visually close to the supplied reference.

## Rendering
- Three.js Neutral tone mapping in gameplay scenes to preserve the reference palette
- PMREM image-based/environment lighting
- desktop SSAO/contact shading
- SMAA post-process antialiasing
- high-quality key shadows
- mobile-safe direct rendering path
- restrained fog / atmospheric perspective
- physically plausible material response

## Asset quality
Prototype procedural geometry and tiny placeholder GLBs are not considered final art.

Production assets should include:
- meaningful geometry detail
- authored base-color/albedo
- normal maps
- roughness maps
- AO where useful
- sensible pivots/scales
- LOD-ready topology
- compressed textures for web/mobile delivery

Current committed GLBs remain temporary visual stand-ins until replaced by production-quality assets.

## Implemented Fort Kochi slice

The approved waterfront direction is implemented in an original image-inspired game world using original procedural game assets: a tiled Mud Meals restaurant, occupied shore stalls, authored shoreline, fishing nets, jetty/boats and a fictional waterfront chapel. The raised follow view and portrait HUD are captured from the running game by `npm run check:maps:browser`. These captures establish current runtime fidelity; the user-provided images remain the visual target.

The current renderer uses official RenderPass/SSAOPass/OutputPass with a multisampled render target, sunlight shadows and environment lighting. SMAA and production scanned GLB replacements above remain aspirations. Rigid vehicle batching preserves shape and materials, while a 30/60 FPS budget and paused/hidden rendering controls address device load. See [measured performance](rendering-performance.md).
