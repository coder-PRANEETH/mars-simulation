# Mars Surface Simulator

A working first-person web prototype on **5.87 km² of reconstructed Martian terrain southeast of Jezero Crater**. The product is the walkable 3D surface: real HiRISE elevation, co-registered orbital imagery, terrain contact, gravity-driven jumps, and simulated surface weather.

## Run

Requires Node.js **20.19+ or 22.12+** and a desktop browser with WebGL 2 and keyboard/mouse support.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). Choose **Walk** and click **Start exploring** to capture the mouse, or choose **Drive a rover** to keep the cursor free. The original datasets have already been cropped and packaged in `public/terrain`; Python, external APIs, credentials, and a backend are not needed to run the prototype.

```bash
npm run build       # production build in dist/
npm run preview     # serve the production build locally
npm test            # deterministic physics, real-terrain and environment tests
```

Optional browser acceptance check:

```bash
npx playwright install chromium
npm run test:browser
```

The development server binds to all interfaces for local preview. Production deployments should serve `dist/` using ordinary static hosting. Pointer lock works on localhost or a secure HTTPS origin.

## Discover Mars

Explore uses a dark space-mission interface with short instructions for young
explorers. **Discover** opens three revealable questions about gravity, rusty
soil and Jezero's ancient lake. Each answer links to its NASA source and suggests
something to try in the simulator. The questions are also available while driving.
The planet illustration is decorative. The ground uses orbital terrain data,
while its colours, local rocks and weather are simulated.

## Jezero Expedition Planner

Select **Explore Jezero** to open the planner inside Jezero Crater. The crater
overview uses the USGS 20 m CTX elevation mosaic. The outlined traverse area
opens a 19.48 km² western-delta crop from the Mars 2020 USGS HiRISE products,
with 1 m source elevation posts sampled every eighth post and matched 25 cm
source imagery. Select **Back to exploring** to walk the same mesh in first
person. **Southeast hills** returns to the original simulator terrain.

The detailed map lets you inspect elevation and slope and highlight steep or
locally uneven terrain. The slope limit is an adjustable planning assumption.
Small obstacles below the grid scale require independent observations.

The science markers use NASA Perseverance locations where available and
identify the approximate Kodiak viewpoint separately. Neretva Vallis appears
in the crater overview beyond the routeable area. Mars Odyssey THEMIS nighttime
IR adds regional thermal contrast at 100 m source resolution. Its stretched
brightness values do not provide a temperature or measure present conditions.
The planner also displays NASA's archived Perseverance MEDA air temperatures,
pressure, and local sunrise/sunset for sols 1130–1133. The source records are
dated April 2024 and are provided as environmental context.

To plan a traverse, click **Set start** and **Set destination**, or choose
**Try a route**. Use **Mark avoid zone** to exclude a 40 m radius around
an identified obstacle. The planner automatically compares a terrain-first route
with a route that visits a selected science stop or the highest-priority
reachable stop for the chosen objective. Both routes use the same slope and
avoid-zone constraints. **Drive route** starts the car at the selected start pin facing along the route.
**Walk route** places the explorer at the same pin. Both show ground traces,
beacons, and a bearing to the next waypoint.

The planner runs A* on the same two-triangle cells used for the 3D terrain.
Distance follows the surface and time depends on the selected pace, along-route
grade, unevenness and scenario allowances for dust and thermal load. The
out-and-back estimate assumes retracing the route. Pace and uncertainty bounds
are scenario settings informed qualitatively by the [Norcross suit study](https://www.lpi.usra.edu/lunar/artemis/NorcrossEtAl_NASA-TP-2010-216115_PlanetarySuitMetabolicCosts.pdf).
The study used level treadmill trials. Estimates exclude rest and time spent
on science, and carry no operational EVA limits.

The **Regions** switch shows published USGS geologic units at their regional
1:75,000 map scale. Six unit types intersect the playable western-delta crop.
Select a region in the legend, or inspect a map point, to see its name and a
short geological description. The crater overview includes the wider set of
mapped units. Unit symbols preserve the source numeric suffixes.
The planner adds a travel cost for geological region models and for cells
intersecting mapped eolian bedforms or dark mantling material. These are broad
geologic observations. Mark a local obstacle as an avoid zone when its position
is known. Rebuild the geology and advisory grid with
`python scripts/prepare-jezero-geology.py PATH_TO_NILI_GDB`, using the
[USGS SIM 3464 database](https://pubs.usgs.gov/publication/sim3464) and
`pip install -r scripts/geology-requirements.txt`. A registered Uint8 grid
stores one published unit ID per terrain cell. Zero means unmapped. The original
southeast-hills crop is outside this geologic map and remains explicitly unmapped.

The public [NASA M20 map](https://mars.nasa.gov/maps/?mission=M20), built with
[MMGIS](https://github.com/NASA-AMMOS/MMGIS), was checked on November 12, 2026.
Its public layer configuration provides imagery, rover paths, waypoints and
sample locations, but no soil-strength, vehicle-speed or wheel-sinkage raster.
The regional boundary source here is USGS SIM 3464, rather than an inferred
segmentation of the NASA viewer's imagery.

The packaged data works offline. To rebuild the detailed or crater-wide
assets, install `numpy`, `Pillow`, `rasterio` and `pyproj` and run
`python scripts/prepare-jezero.py detail` or
`python scripts/prepare-jezero.py overview`. Use the `thermal` option for THEMIS. The script reads the required
GeoTIFF samples from USGS without downloading the full mosaics.

## Controls

| Input | Action |
| --- | --- |
| Click viewport / Enter simulation | Capture mouse, enter first person |
| W / S | Forward / backward |
| A / D | Strafe left / right |
| Mouse | Look freely |
| Space | Jump; release before the next jump |
| Shift | Sprint |
| Esc | Release the cursor |
| E | Raycast through the crosshair to inspect terrain |
| F3 | Toggle physics diagnostics and FPS |

The camera is the player's head, **1.7 m above their feet**. Walking includes acceleration, deceleration, limited air steering, ground detection, slope grip, and sliding. The small camera gait and landing offsets provide feedback; jump motion comes from the simulated body.

Open **F3** diagnostics to see vertical velocity, height above ground, grounded state, and airborne time. Holding Space does not repeat the jump.

## Car mode

Choose **Drive a rover**, then **Start exploring** on the entry screen. Press **Esc** to pause
driving and return to the entry panel. Use **W/S** to drive or reverse, **A/D** to steer, **Space**
to brake. Drag the terrain to orbit the chase camera. The cursor stays
free for map and dashboard controls. The **Hazards** switch shows a local map
centered on the car. In Jezero, it uses the planner’s slope limit, mapped
surface cautions, and marked avoid zones. Its **Land types** toggle colors the
same minimap by mapped geology and surface cover. Hazard boundaries and a local
caution/avoid label remain visible above the land overlay. The selected mode
persists when hiding and reopening the minimap. Unmapped regions are labeled
as such. Switch back to foot mode
at your current position. The car works in both regions and can follow a
selected Jezero route. Route time estimates describe walking.

The expedition car uses the measured heightfield and a separate handling
profile, with a flat, firm-ground speed limit of 54 km/h before traction
and softness adjustments. These are game-vehicle speeds, not Perseverance's
operational speeds. Both walking and driving sample the registered unit and
overlying surface cover at the current position. Responses blend across cell
boundaries. The elevation mesh supplies additional roughness and slope penalties.
The route engine uses the same regional base speed factors for path costs and
walking-time penalties, and lists the regions crossed in Route details.

### Modeled surface characteristics

The published polygons identify geological units, not uniform soil strength.
The coefficients below are explicit educational assumptions in
`src/terrain/materials.js`. They are not values supplied by NASA's map or USGS.
Source morphology and unit descriptions inform the choice of model category.
Sand and dark mantling observations can override the underlying unit's response.

| Model category | Base speed factor | Grip factor | Maximum modeled wheel settling |
| --- | ---: | ---: | ---: |
| Crater-floor rock | 100% | 1.00 | 0 cm |
| Layered delta rock | 84% | 0.92 | 0 cm |
| Etched rock | 76% | 0.88 | 0 cm |
| Broken rock / crater rim | 67% | 0.86 | 0 cm |
| Mixed rock | 88% | 0.94 | 0 cm |
| Eolian sand | 42% | 0.64 | 16 cm |
| Smooth loose cover | 70% | 0.78 | 7 cm |
| Dark mantling cover | 75% | 0.80 | 5.5 cm |

Wheel settling grows gradually under load and throttle, adds rolling resistance,
and recovers on firm ground. Slipping wheels rotate faster than their ground
travel would imply. Grip also affects steering and braking. The vehicle model
is lowered visually by the settling depth, while collision and source DEM
elevations remain unchanged. This is not soil deformation or a calibrated
terramechanics solver. Walkers slow on the same materials but have no wheel sinkage.

### Visible traction and rover movement

A separate **Rover / Ground contact** display shows wheel slip, sideways slide
and wheel sinking, with short recovery hints. The four live telemetry fields
remain wind, temperature, coordinates and speed. The traction display yields
space when opening learning or ground-information panels.

The rover uses gradual front-wheel steering and a 2.59 m bicycle-model
wheelbase, matched to the visual wheel positions. Heading changes depend on
forward/reverse speed. The horizontal velocity retains momentum while tire
forces correct lateral motion. Acceleration, cornering and braking share a
gravity- and grip-dependent force budget. Releasing throttle allows coasting;
pausing applies a parking brake. Small body pitch/roll and a damped chase camera
provide movement feedback. This remains an illustrative game model, not a
validated dynamics model of Perseverance or a full suspension solver.

Mapped loose cover produces bounded wheel dust and paired tread marks during
motion. Tracks conform to the terrain and fade, with a maximum of 320 segments;
wheel dust is pooled to 96 particles. They clear on reset and are not emitted on
unmapped or exposed-rock surfaces. These are artistic motion cues, not source
imagery or physical soil deformation. The minimap's blue dashed line shows the
direction of travel, which can differ from the rover's nose during a slide.

The **Current surface condition** control opens mapped unit information and
the simulated response. The terrain scanner (**E**) reports the same local
ground model at the point being inspected. These details stay separate from
the four live telemetry fields. On unmapped terrain, only slope and roughness
modify the neutral model; no sand or wheel sinking is invented.

## Simulated surface weather

Each session starts with a generated wind speed (6–44 km/h) and air temperature
(−85 to −45°C). Both refresh every 30 seconds. Wind drives the dust effects,
and temperature is informational. Live telemetry shows those two values,
coordinates, and travel speed. The planner’s archived Perseverance observations
remain available separately under **Map information**.


## Real NASA / public terrain data

Credit: **NASA/JPL-Caltech/University of Arizona**. Dataset: **MRO Mars High Resolution Imaging Science Experiment DTM V1.0**, `MRO-M-HIRISE-5-DTM-V1.0`.

| Data | Product and public source | Original resolution |
| --- | --- | --- |
| Stereo elevation | [DTEED_042328_1985_033150_1985_A01.IMG](https://www.uahirise.org/PDS/DTM/ESP/ORB_042300_042399/ESP_042328_1985_ESP_033150_1985/DTEED_042328_1985_033150_1985_A01.IMG) | 2.0194076 m/post |
| Matched orbital image | [ESP_042328_1985_RED_B_01_ORTHO.JP2](https://www.uahirise.org/PDS/DTM/ESP/ORB_042300_042399/ESP_042328_1985_ESP_033150_1985/ESP_042328_1985_RED_B_01_ORTHO.JP2) | 0.5048519 m/pixel |

[Product page: Hill Southeast of Jezero Crater](https://www.uahirise.org/dtm/ESP_042328_1985). [HiRISE DTM documentation](https://www.uahirise.org/dtm/about.php).

- Crop center: **18.180814° N, 78.209877° E**, planetocentric, east-positive.
- Extent: 18.160365–18.201263° N and 78.188706–78.231047° E.
- Dimensions: **2423.289 × 2423.289 m**, **5.87233 km²**.
- Terrain: **401 × 401 measured vertices**, 6.058223 m spacing, 320,000 triangles.
- True elevation: **−875.445 to −481.209 m** relative to the source Mars 2000 areoid.
- Image: 4096² JPEG, geographically matched to the same DEM-post bounds.
- **Vertical exaggeration is 1**. Primary hills, depressions and ridges come from the DEM; no random terrain is substituted.

The HiRISE RED image is a single grayscale band. The renderer adds a warm tint, oblique sunlight, and close-up material grain to the source imagery. Small decorative rocks are placed on the measured surface around the observer. **Terrain & data** in the HUD exposes sources, bounds, resolutions, datum, attribution and transformations.

See [DATA_SOURCES.md](DATA_SOURCES.md) for exact product URLs, source hashes, projection equations, input dimensions and independent source verification. Original PDS labels are preserved in `public/terrain`.

## Preprocessing

Static assets are included. To reproduce them:

```bash
python -m venv .venv-terrain
source .venv-terrain/bin/activate
pip install -r scripts/terrain-requirements.txt
python scripts/prepare-terrain.py
```

The preprocessing script downloads the original DEM, orthoimage and label into a cache; reads the actual PDS georeferencing; crops DEM rows 2900–4100 and columns 1200–2400; retains every third measured post; translates the elevation origin by −497.995605 m; crops the matched image to the same geographic bounds; resizes it bilinearly to 4096²; applies a 1st–99th percentile contrast stretch; and writes the binary heightfield, JPEG and metadata. It rejects missing elevation posts. This origin translation does not alter scale or relief.

For a different crop of this product:

```bash
python scripts/prepare-terrain.py --row 3000 --column 1300 --span 1200 --stride 3
```

For another Mars DEM, replace the source URLs/product IDs, validate its units, datum, map projection and missing-value encoding, and select a small valid region. Reproject a matching **orthorectified** image into its bounds. Produce the same `metadata.json` + little-endian `heights.bin` + `texture.jpg` contract. Set a walkable spawn. Do not add invented elevations to fill missing source data. The detailed steps are in [DATA_SOURCES.md](DATA_SOURCES.md).

## Architecture

```text
src/
  App.jsx                    asset loading, Canvas, HUD and input state
  terrain/terrain.js         shared DEM sampling, slope, normal, coordinates
  physics/PlayerPhysics.js   deterministic body integration and terrain contact
  simulation/store.js       environmental values, presets and subscriptions
  simulation/environment.js environment queries shared by all entities
  scene/Player.jsx          pointer lock, input, physics steps and head camera
  scene/Terrain.jsx         indexed DEM mesh and matched orbital image
  scene/World.jsx           light, Mars sky, fog and inspection marker
  scene/Dust.jsx            limited wind-advected particles
  scene/Rocks.jsx           instanced illustrative ground pebbles
  ui/                       unobtrusive HUD and simulation controls
public/terrain/              packaged source-derived static assets
scripts/prepare-terrain.py   reproducible offline dataset processing
```

React + JavaScript, Vite, Three.js, React Three Fiber and drei are used. This prototype uses a small **custom heightfield character solver**, rather than Rapier. There is no invisible flat collision plane. Both the mesh and collision use identical `a,c,b` / `b,c,d` triangles, so elevation and slope queries match the displayed surface exactly. The player is a simulated body with feet position, velocity, ground constraints and horizontal contact on steep slopes. It is not a general rigid-body capsule simulation.

The physics runs at **120 Hz** with an accumulator independent of rendering. Jumping applies **3.4 m/s upward velocity**, then integrates the selected gravity. On flat ground this yields roughly 1.54 m / 1.83 s under Mars gravity and 0.58 m / 0.69 s under Earth gravity. Gravity is queried each step. Horizontal movement uses traction-dependent acceleration and braking, reduced speed on loose regolith, slope response, and restricted air acceleration. The camera follows the body with restrained gait, landing impact and sprint FOV feedback.

Validation covers original PDS samples, collision triangles, real-terrain movement, gravity, registered geology, material transitions and route costs. Rover checks verify stationary/reverse steering, force limits, coasting and braking under different gravity, plus visible dust, tracks, steering, wheel sinking and minimap overlays in the browser. The browser flows also exercise pointer lock, Mars/Earth jumps, inspection, F3 diagnostics, weather and the four live telemetry fields.

The environment API is intentionally small:

```js
environment.getGravity();
environment.getSurfaceFriction(position);
environment.getRegolithSoftness();
environment.getTerrainHeight(position);
environment.getSlope(position);
environment.getTemperature(position);
environment.getWind(); // m/s vector, bearing and density
environment.getState();
```

To add a rover, pass the **same environment object and terrain** to its controller. Query height, normal and grip at each wheel contact, apply vehicle forces at a fixed timestep, and consume `getTemperature` in future battery/thermal models. If using Rapier for a rover, construct its heightfield or triangle collider from these same measured heights and topology; update world gravity from the store. Vehicle mass, suspension and tire response belong to the vehicle. Do not create a separate environmental state or flat ground collider.

`E` casts a camera-center ray to the actual terrain mesh and reports coordinates, areoid elevation, local triangular slope, the registered geologic unit and the modeled local ground response. Mineral measurements are not inferred from the image color.

## Known simplifications and performance

- DEM downsampling omits detail below about 6 m. Triangular interpolation does not invent higher-resolution measurements. Mesh normals are smoothed for lighting; scientific/contact normals are the actual triangle normals.
- No terrain overhangs or caves; no general rigid-body object collisions. Illustrative pebbles are small visual dressing, without individual colliders or mapped geological positions.
- Global friction/softness values and regional handling coefficients are simulation parameters, not spatial geotechnical measurements. Sliding uses a simplified Coulomb model; shallow wheel settling is visual and adds modeled resistance. There is no foot biomechanics, deformable soil or pressure-dependent terramechanics solver.
- Orbital imagery contains acquisition shadows. Added sunlight is visual and is not a reconstructed illumination epoch. Sky, dust and fog are artistic browser approximations, not atmospheric circulation or radiative-transfer simulations.
- The local plane omits planetary curvature and has a bounded edge. The player cannot move outside the measured crop. Temperature is currently informational.
- Nominal speeds (4.3 m/s walk, 7 m/s sprint before soil/slope effects) are FPS tuning values. No oxygen, life support, fatigue or suit model is included.
- Rendering uses one indexed terrain mesh, one instanced pebble mesh, at most 650 dust particles, a 4096² JPEG, a 1024² local shadow map and pixel ratio capped at 1.5. This region does not need a global tile/LOD system.
- Software WebGL can be slow. Use hardware acceleration for normal play. Long rendering stalls cap catch-up time to keep input and collision stable; simulation time may lag wall time on severely underpowered devices. FPS is displayed only in F3 mode.
- The intended acceptance target is a modern laptop. Headless acceptance checks verify behavior using software WebGL; they do not certify a hardware frame-rate benchmark.
# mars-simulation

### Scroll zoom

Scroll over either mission map to zoom toward the cursor (up to 12×); drag to pan. The +/− and reset controls also work with keyboard/touch. Map picks remain in the original georeferenced coordinates. Scroll over the rover view to change chase-camera distance, or while walking to change the field of view. UI panels keep their normal scrolling.

### Biology research and rover evidence

The supplied `Bio_Jezero.docx` informs the Life & science notebook and Marswalk concept. Its proposals are not NASA operating requirements. Cheyava Falls is a **potential biosignature**, not confirmed life; compare biological and nonbiological interpretations ([NASA/JPL, 2025](https://www.jpl.nasa.gov/news/nasa-says-mars-rover-discovered-potential-biosignature-last-year/)). Total chlorine is not a perchlorate concentration, and no toxicity raster or safe-to-grow-food claim is inferred from land type. See [SuperCam research](https://doi.org/10.1029/2025JE008943).

The optional Collected samples layer preserves 22 mapped collection-location features from [NASA MMGIS M20_SAMPLE_v3.json](https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_SAMPLE_v3.json), retrieved 2026-11-14. Some features combine samples; this is not a complete inventory or live feed, and collection positions do not locate cached tubes. Sapphire Canyon's coordinate comes from this file. Its `outcrop_name` says Beaver Falls, while NASA's published science identifies Cheyava Falls; we retain the sample identity/coordinate and attribute the science separately. Cheyava Falls is outside the playable western-delta DEM and is shown only on the crater overview. No terrain or route is fabricated there.

Credited local images: Cheyava Falls WATSON close-up, sol 1212, [PIA26368](https://www.jpl.nasa.gov/images/pia26368-perseverance-finds-a-rock-with-leopard-spots/), NASA/JPL-Caltech/MSSS; Western Delta Mastcam-Z panorama, sol 406, [PIA25212](https://www.jpl.nasa.gov/news/nasas-perseverance-rover-arrives-at-delta-for-new-science-campaign/), NASA/JPL-Caltech/ASU/MSSS. Images are reduced for display, not registered terrain textures.

The [2026 challenge resources](https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/?tab=resources), reviewed 2026-11-14, link Mars Trek, USGS planetary maps, Curiosity's Mount Sharp route example, NASA Worldview and Perseverance raw images. The simulator uses local MRO topography/imagery, Odyssey THEMIS context, published USGS geology and archived Perseverance observations. Ground-level site imagery and links extend its field-science context. Worldview's Earth layers are not presented as Jezero measurements, and Curiosity/Gale measurements are not relabelled as Jezero data.

### Marswalk planning and suit simulation

Choose the **Marswalk** workspace in the mission map and enable **Apply suit budget to Walk route**, choose the start/base and destination, then compare the selected terrain or science route's outbound walk, planned science task, retraced return and reserve. The optional feature blocks **Walk route** if its oxygen, duration, heat or chosen shelter scenario fails; ordinary exploration and rover mode remain available. Green/red bands check oxygen/time/shelter return margins at points along the route. The full excursion separately checks peak heat storage. Routes still use terrain-aware A*, not a claim of globally optimal physiological cost. Science per litre is a team-proposed metric, not NASA's Work Efficiency Index.

Inputs: body mass, suit/tools mass, leg length, usable metabolic oxygen (STPD litres), cooling capacity, mission duration, reserve and science effort/duration. The route planner's walking pace sets the nominal Marswalk speed; Shift allows a faster gait. Ordinary game walking keeps its existing speed. The start is a **simulated** base/shelter, not an actual Martian facility.

The educational model is explicit in `src/simulation/eva.js`:
- Reference effort 350 W at 1 m/s, 75 kg body + 50 kg suit/tools on firm level ground. This reference comes from the average design assumption of [NASA ICES-2026-158](https://ntrs.nasa.gov/citations/20260002884); the paper's 530 W maximum is a design assumption, not a universal human limit. Our speed^1.5, mass^0.6, grade and roughness/soft-ground response curves are illustrative and are not fitted or validated suited-Mars physiology. We do not scale metabolism linearly with gravity or claim a validated Mars adaptation of Pandolf.
- Oxygen = metabolic joules / 20,190 J per STPD litre (approximately 4.825 kcal/L, [NASA CR-1726](https://ntrs.nasa.gov/citations/19720004399)). This excludes suit leakage, ventilation and other oxygen-system losses. Default 600 L is a game budget, not the certified usable capacity of a suit.
- Heat storage integrates max(0, previous heat + (metabolic W − cooling W) × seconds). All metabolic energy becomes model heat; solar/external heat, evaporation, changing cooling efficiency, and physiological thermoregulation are omitted. No heart rate, core temperature, pressure or CO₂ is fabricated. A 3 kJ/kg ceiling references the nominal upper bound in [NASA spacesuit requirements](https://www.nasa.gov/reference/11-0-spacesuits-vol-2/), which require a detailed human thermal model; this simple balance does not demonstrate NASA compliance or predict health.
- Froude transition sqrt(0.5 × g × leg length) indicates a possible walk–lope transition, not a speed cap or proof that suited loping on Mars is more efficient. There is no invented reduction in cost above this estimate.
- The default 30 min reserve, task rates (220/350/500 W), constant 450 W cooling and 2 h maximum return-to-shelter scenario are configurable/conceptual choices, not measured Jezero conditions or NASA exclusions.

After launching a Marswalk, expand the separate **Suit model** display (Esc releases the walking cursor). It integrates effort, metabolic oxygen and heat while the walk is active. Pausing or opening the map pauses its clock. Near the planned work point, logging a task advances the model clock by that task duration and charges its energy/oxygen/heat once. **Head home** follows recorded footsteps; this is not a newly surveyed safe shortcut. The extra-time estimate subtracts return and reserve at the current effort and is model-dependent. Switching regions, changing route pins, switching to a rover, resetting or ending the suit simulation clears the mission.

**Practice a solar-storm alert** is a manually triggered drill, not a forecast or radiation feed. No Gale/Curiosity RAD value is presented as a Jezero measurement. NASA's [radiation protection brief](https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf) motivates shelter/alert awareness; the simulator does not compute a radiation dose or certify shelter shielding. Live telemetry retains exactly wind, temperature, coordinates and speed.


### Mission map workspaces

The map has three workspaces: **Route** (pins, route choices and avoid areas), **Marswalk** (suit estimates and budgets), and **Discover** (science sites, published regions, sample collection locations, field notes and archived weather/data). Only one reading view is visible at once. Workspace changes preserve pins, selected routes, zoom, overlay choices, expanded settings, suit input values and the selected field-note topic. They cancel an unfinished map-picking action to prevent accidental route changes.

**Layers** is an independent map popup. Hazards, geologic regions, science sites, samples and thermal context can stay enabled across workspace changes without opening information panels. Where geology and hazards overlap, hazards use boundaries above the geologic colours. The collapsed map key describes only the visible layers. **Discover** lets the reader browse datasets without requiring every map overlay to be on. Selecting a specific geologic unit, site or sample highlights its dataset/location.

Selecting a map point or science/sample marker replaces the reading view with place details; **Back to workspace** restores the previous view. The permanent bottom bar shows the selected route and provides **Drive route** and **Walk route** from every workspace. Walking alone is restricted by an enabled suit budget; merely visiting Marswalk does not change the mission mode. Use Route settings to mark/undo avoid areas; a temporary map prompt offers Done/Cancel while picking. The extent selector switches between Western Delta terrain and the whole-crater overview without clearing the plan.

On phones the workspace is a collapsible bottom sheet, with a scrollable reading area and the launch controls kept outside it. Tabs also support Left/Right, Home and End on a keyboard. Layer popup Escape/outside-click dismissal and inspector Back navigation preserve context.
