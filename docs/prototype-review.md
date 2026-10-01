# Person and autorickshaw rebuild review

Open `review.html` for the isolated Three.js review stage. Drag rotates the camera; the five view buttons show the person, face detail, autorickshaw, side view and metre-scale comparison.

The customer uses the CC0 MakeHuman hm08 anatomical body topology and 75% of its CC0 adult male morph. The head, eyelids, ears, hands and fingers retain anatomical topology. The source mesh is fitted with clothing surfaces and posed into a relaxed standing stance. The extracted mesh and attribution are in `public/review/`. This prototype is currently a static review pose, not the animated game NPC replacement.

The autorickshaw is independently modeled in metres with curved pressed front panels, narrow window seals and roof supports, recessed reflector/lens headlights, a curved canopy with sewn seams, open passenger entrances, bench and driver seats, formed mudguards and three detailed wheels. It represents a Bajaj RE-inspired Kerala auto, not an exact licensed replica.

These are actual 3D meshes rendered in WebGL, not reference images placed in the scene. The `Render person and autorickshaw prototypes` GitHub workflow checks dimensions and captures five Chromium renders. The main game continues to use the previously deployed assets pending visual review of these two replacements.
