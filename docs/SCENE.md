===========
SCENE INPUT
ZONE:
[ZONE NAME]
SCENE:
[SCENE NAME]
LOCATION INSPIRATION:
[LOCATION]
SCENE TYPE:
[URBAN STREET / MARKET / WATERFRONT / RESIDENTIAL / HARBOR / BRIDGE / RURAL ROAD / etc.]
APPROXIMATE PLAYABLE SIZE:
[EXAMPLE: 100m × 120m]
GAMEPLAY PURPOSE:
[WHAT THE PLAYER DOES HERE]
NEIGHBORING SCENES:
NORTH:
[SCENE]
EAST:
[SCENE]
SOUTH:
[SCENE]
WEST:
[SCENE]
==================================================
EXACT SCENE MATCH — CRITICAL
ALL IMAGES MUST REPRESENT THE EXACT SAME PHYSICAL LOCATION.
Treat the scene as an already-existing 3D game level being photographed from different camera positions.
DO NOT redesign the scene between views.
DO NOT reinterpret the scene.
DO NOT create another similar version.
DO NOT regenerate the environment differently.
DO NOT rearrange objects.
DO NOT invent new buildings.
DO NOT remove existing buildings simply because they are outside the current camera view.
The following must remain consistent across ALL images:
- road positions
- road widths
- road curvature
- intersections
- sidewalks
- curbs
- drainage
- building positions
- building footprints
- building dimensions
- building heights
- roof shapes
- roof materials
- roof colors
- doors
- windows
- balconies
- walls
- fences
- gates
- trees
- major vegetation
- utility poles
- overhead wires
- streetlights
- signs
- shops
- market stalls
- parked vehicles
- boats
- bridges
- waterfront structures
- canals
- terrain
- terrain elevation
- rocks
- major props
- landmarks
- gameplay locations
If an object exists in View 01, its position must logically remain the same in every other view.
If a building has a red tiled roof in one view, it must have the SAME red tiled roof in all other views.
If a road curves left, that same road must curve left from the appropriate viewpoints.
If a shop is on the north side of the road, it remains on the north side.
If three coconut trees are beside a building, their positions remain consistent.
ONLY these things may change:
- camera position
- camera height
- camera orientation
- camera distance
- camera focal length/FOV when necessary
The result must feel as though a real camera physically moved through one continuous 3D environment.
==================================================
NO GENERATIVE DRIFT
Maintain strict visual continuity.
Do NOT allow:
- buildings to change shape
- buildings to change color
- buildings to move
- roads to change direction
- roads to change width
- trees to move
- landmarks to change
- shops to change
- props to randomly appear
- props to randomly disappear
- terrain to change
- waterfront geometry to change
- canals to change
- architecture to change
- environmental density to change
When generating subsequent views, always use:
"Show the EXACT SAME SCENE from a different physical camera position."
Never use:
"Create another similar scene."
==================================================
REFERENCE IMAGE STRATEGY
Generate enough independent views to fully explain the scene.
Do NOT force every scene to have the same number of images.
Simple scene:
3–4 views
Medium scene:
5–7 views
Complex scene:
7–10+ views
Only generate an additional view if it provides useful information that cannot be understood from the existing views.
Avoid redundant images.
Each image must be independently useful for 3D reconstruction.
==================================================
REQUIRED VISUAL COVERAGE
Choose the views required to completely understand the scene.
1. MASTER SPATIAL VIEW
Use a high-angle, elevated, or isometric game-environment viewpoint.
Clearly show:
- complete playable area
- road network
- intersections
- buildings
- building footprints
- open areas
- sidewalks
- parking
- vegetation
- walls
- water
- terrain
- entrances
- important landmarks
- gameplay locations
- scene boundaries
This is the primary spatial reconstruction reference.
The camera should be high enough to understand the layout while keeping objects readable.
2. PLAYER GAMEPLAY VIEW
Use a third-person motorcycle/rider perspective.
Show what the player would actually see while driving through the scene.
Include:
- road width
- lane structure
- traffic
- buildings
- sidewalks
- pedestrians
- parked vehicles
- obstacles
- signs
- vegetation
- delivery locations
- turning space
- intersections
Make it look like an actual playable game environment.
NO HUD.
NO minimap.
NO quest markers.
NO speedometer.
NO UI.
3. REVERSE PLAYER VIEW
Show the EXACT SAME ROAD/AREA from the opposite direction.
Reveal:
- opposite building facades
- road depth
- traffic flow
- intersection layout
- road connections
- environmental continuity
Do NOT mirror the previous image.
Move the camera to a physically different location within the SAME scene.
4. SIDE / CROSS-STREET VIEW
Use a different lateral camera position.
Reveal details hidden from the main road:
- side streets
- alleys
- building entrances
- compound walls
- drainage
- utility poles
- shops
- parking
- vegetation
- terrain changes
- shortcuts
5. ARCHITECTURE VIEW
Generate only when architecture needs additional explanation.
Show the actual buildings belonging to this scene:
- Kerala tiled roofs
- concrete buildings
- colonial architecture where appropriate
- shops
- restaurants
- houses
- balconies
- doors
- windows
- awnings
- compound walls
- signs
Architecture must EXACTLY match the buildings shown in the spatial views.
6. ENVIRONMENT / PROP VIEW
Generate when important environmental assets require additional reference.
Show relevant scene-specific:
- coconut trees
- banana plants
- tropical vegetation
- drainage
- utility poles
- overhead wires
- streetlights
- benches
- garbage bins
- market stalls
- crates
- fishing equipment
- boats
- scooters
- motorcycles
- auto-rickshaws
- buses
- road barriers
- walls
- pavement
- curbs
Only show props that actually exist in this scene.
7. LANDMARK VIEW
Generate only when the scene contains an important landmark.
Examples:
- Chinese fishing nets
- colonial building
- temple
- church
- mosque
- bridge
- ferry point
- market entrance
- distinctive restaurant
- waterfront structure
The landmark must exactly match its position and appearance in all other views.
8. SCENE CONNECTION VIEW
Show how the scene continues into neighboring scenes.
Clearly communicate:
- roads continuing
- side streets continuing
- canals continuing
- waterfront continuing
- terrain continuing
- building density transitions
- major roads connecting to smaller roads
The scene must feel like one part of a continuous open world.
Never make it look like an isolated game level.
==================================================
KERALA / KOCHI IDENTITY
Use believable Kerala environmental characteristics.
Architecture:
- Kerala tiled roofs
- laterite walls
- plastered concrete buildings
- traditional houses
- colonial architecture where appropriate
- narrow shops
- compound walls
Vegetation:
- coconut palms
- banana plants
- tropical trees
- bougainvillea
- dense roadside greenery
Infrastructure:
- Indian roads
- Kerala-style drainage
- utility poles
- overhead electrical wires
- streetlights
- sidewalks
- curbs
- Malayalam signage
- Indian road markings
Vehicles:
- motorcycles
- scooters
- auto-rickshaws
- Kerala buses
- compact Indian cars
- delivery vehicles
Waterfront scenes may include:
- fishing boats
- Chinese fishing nets
- small piers
- fishing nets
- crates
- seawalls
- canals
- ferry infrastructure
- waterfront roads
Commercial areas may include:
- tea shops
- bakeries
- restaurants
- cafés
- spice shops
- fish markets
- grocery shops
- roadside stalls
Use location-appropriate assets rather than adding every possible Kerala element.
==================================================
GAMEPLAY-FIRST DESIGN
The scene must work for motorcycle gameplay.
Consider:
- motorcycle turning radius
- road width
- overtaking
- traffic flow
- intersections
- shortcuts
- narrow alleys
- parking
- restaurant pickup locations
- customer delivery locations
- rival ambush opportunities
- chase routes
- obstacles
- alternate routes
- road hazards
Do not make every road identical.
Use believable variation:
- major roads
- secondary roads
- narrow streets
- service roads
- alleys
- shortcuts
- dirt/mud roads where appropriate
==================================================
SPATIAL READABILITY
Prioritize information in this order:
1. spatial layout
2. road geometry
3. building placement
4. gameplay space
5. scene connections
6. terrain
7. landmarks
8. architecture
9. vegetation
10. props
11. decorative details
The developer must be able to answer:
"WHERE IS EVERYTHING?"
before asking:
"WHAT COLOR IS EVERYTHING?"
==================================================
VISUAL STYLE
Use:
- stylized-realistic 3D
- modern open-world game quality
- realistic proportions
- crisp geometry
- readable forms
- PBR-like materials
- believable lighting
- realistic environmental density
- game-ready visual language
Avoid:
- tourism photography
- travel brochure styling
- generic Indian city imagery
- Western architecture
- fantasy architecture
- excessive cinematic effects
- extreme depth of field
- concept-art painting
- anime/cartoon styling
- giant empty areas
- unrealistic roads
- UI
- HUD
- minimaps
- quest markers
- presentation graphics
==================================================
CAMERA VARIATION
Use genuinely different physical camera positions.
Possible viewpoints:
- elevated overview
- isometric
- low aerial
- player/rider view
- reverse player view
- side street
- cross street
- alley
- waterfront
- building-front view
- rooftop-height view
- environmental close-up
DO NOT:
- crop one image into another
- zoom the same image
- rotate the same image
- create fake alternate angles
- use different locations
Every view must be a genuine camera view of the SAME physical scene.
==================================================
FINAL VALIDATION
Before finalizing the reference package, verify:
[ ] All images show the EXACT SAME physical scene.
[ ] Road geometry is consistent.
[ ] Building locations are consistent.
[ ] Building shapes are consistent.
[ ] Terrain is consistent.
[ ] Major vegetation is consistent.
[ ] Landmarks are consistent.
[ ] Props remain logically positioned.
[ ] Waterfront/canal geometry is consistent.
[ ] Different camera positions reveal additional information.
[ ] Player movement is understandable.
[ ] Scene boundaries connect logically to neighboring scenes.
[ ] Kerala/Kochi identity is clearly visible.
[ ] The scene looks like a real playable game environment.
[ ] There is NO HUD.
[ ] There is NO UI.
[ ] There is NO giant map.
[ ] There are NO cropped map tiles.
[ ] There are NO unrelated locations.
[ ] There is NO unnecessary image duplication.
If any view conflicts with the established scene, regenerate that view.
==================================================
FINAL OBJECTIVE
Create a complete visual reconstruction reference for ONE SMALL PLAYABLE SCENE.
The final reference set should allow an AI game-development system to reconstruct:
- the road layout
- building placement
- terrain
- gameplay space
- environmental assets
- landmarks
- scene boundaries
- neighboring connections
- overall Kerala/Kochi identity
Think like a professional game-development team documenting an already-built 3D level.
The goal is NOT cinematic beauty.
The goal is:
EXACT SCENE MATCH
+
MULTI-ANGLE RECONSTRUCTION
+
SPATIAL ACCURACY
+
GAMEPLAY READABILITY
+
KERALA AUTHENTICITY
+
CONTINUOUS OPEN-WORLD CONNECTIVITY
