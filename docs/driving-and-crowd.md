# Driving and NPC update

The approved textured customer is the visual base for 27 world pedestrians. Four authored CC0 clothing/hair constructions are used: collared shirt, striped shirt, short-sleeved T-shirt and ponytail/casual female outfit. Pigments and small build differences give additional variety. These are contemporary everyday outfits; mundu and sari meshes are not included. Source provenance and modifications are in `public/characters/LICENSE.txt`.

The game crowd uses independent cloned skeletons with shared geometry/texture atlases. A 16-joint skeleton drives walking, idle head movement, greetings and seated dining. The original route/occupancy state machine remains responsible for paths and avoiding other people. The high-detail review model is preserved in `review.html`; `crowd.html` inspects the actual game wardrobe and animation.

Scooter dynamics use metres/seconds with small integration steps: throttle ramps, speed-dependent engine force, rolling/aerodynamic drag, grade resistance, wet braking grip, corner speed limits, turning inertia and leaning. Steering rotates the bike; acceleration moves it along its own heading. Releasing steering lets it continue in that direction without snapping to the turquoise guide. The rider controls acceleration and braking directly; traffic brakes predictively around it. Movement sweeps of at most 0.2 metres prevent tunnelling. Speed caps at 14 m/s (50.4 km/h), with actual cruise reduced by drag, hills and traffic. The bike can take side roads and cross open ground. Terrain and road elevations set wheel height; traffic, pedestrians, scenery, steep ledges and water block movement. Suspension and crash/ragdoll dynamics are not implemented.

Traffic has different cruise/acceleration limits for buses, cars, autos, vans and bikes. It slows for bends, rain and stopping distance to the vehicle ahead. The follow camera is the default, at an 8-metre base distance; the original reference composition is still selectable.

Checks: `node scripts/check-driving.mjs`, `npm run check`, `node scripts/check-crowd-browser.mjs`, `node scripts/check-game-update.mjs`, `npm run build`. Browser checks capture real Three.js renders and do not imply visual acceptance or real-device performance.

On the test model, flat-road cruise settles at 42.5 km/h. Braking from 40 km/h takes 9.0 m / 1.67 s dry and 13.0 m / 2.42 s wet (without human reaction time). In-game Chromium input checks verify acceleration, heading retention after steering release, braking, movement on open ground without snapping to the guide, and simultaneous phone touches for acceleration and steering.

The full game check supports `HARDWARE_GL=1` on Linux machines with working Mesa/OpenGL drivers. Default Chromium software rendering stalls on this development machine's full world; isolated crowd checks pass in software rendering. Hardware acceleration confirms the connected game controls and real world renders. Physical mobile-device performance remains unverified.

Verified 2026-10-02: production build, driving/world Node checks, software Chromium wardrobe renders, and the complete hardware Chromium browser suite (traffic spacing, walking/greetings, camera/depth, districts/weather, controls and landscape resizing). No page errors occurred in the hardware suite. Screenshots are saved under `artifacts/` locally.
