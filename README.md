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
surface cautions, and marked avoid zones. Switch back to foot mode
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

Validation includes 19 passing deterministic tests (original PDS sample values, exact collision triangles, measured-terrain traversal/jumps/sliding, environment updates) and a passing Playwright acceptance flow. The browser flow enters pointer lock, walks on the real terrain, compares Mars/Earth jumps, looks and inspects, toggles F3, uses the internal simulation API to verify particle and fog response, and checks the four live telemetry fields. Browser-measured jump samples were approximately **1.52 m / 1.82 s** on Mars and **0.57 m / 0.69 s** on Earth.

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
