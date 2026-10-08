# Mars Surface Simulator

A working first-person web prototype on **5.87 km² of reconstructed Martian terrain southeast of Jezero Crater**. The product is the walkable 3D surface: real HiRISE elevation, co-registered orbital imagery, terrain contact, gravity-driven jumps, and live environmental controls.

## Run

Requires Node.js **20.19+ or 22.12+** and a desktop browser with WebGL 2 and keyboard/mouse support.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). Click **Enter simulation** or the viewport to capture the mouse. The original datasets have already been cropped and packaged in `public/terrain`; Python, external APIs, credentials, and a backend are not needed to run the prototype.

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

## Controls

| Input | Action |
| --- | --- |
| Click viewport / Enter simulation | Capture mouse, enter first person |
| W / S | Forward / backward |
| A / D | Strafe left / right |
| Mouse | Look freely |
| Space | Jump; release before the next jump |
| Shift | Sprint |
| Esc | Release pointer lock, use environment controls |
| E | Raycast through the crosshair to inspect terrain |
| F3 | Toggle physics diagnostics and FPS |

The camera is the player's head, **1.7 m above their feet**. Walking includes acceleration, deceleration, limited air steering, ground detection, slope grip, and sliding. The small camera gait and landing offsets provide feedback; jump motion comes from the simulated body.

To compare jumps, stand still, jump under Mars gravity, press Esc, open **Environment**, choose **Earth 9.81**, and jump again. Open F3 diagnostics to watch vertical velocity, height above ground, grounded state, and airborne time. Holding Space does not cause automatic repeated jumps.

## Environmental controls

All values live in a single simulation store. Sliders and presets take effect on the next physics/frame update, including gravity changes during a jump.

| Parameter | Range / behavior |
| --- | --- |
| Gravity | 0.5–15 m/s²; Moon 1.62, Mars 3.71, Earth 9.81 presets |
| Wind | 0–150 km/h; particle advection, without pushing the human |
| Wind direction | Clockwise bearing from north; the direction particles travel **toward** |
| Regolith softness | Hard to loose; lower maximum speed, acceleration and effective grip |
| Friction | 0.1–1.5; stopping distance and Coulomb-style slope grip/sliding |
| Atmospheric density | 0–1.225 kg/m³; simplified dust entrainment and haze |
| Temperature | −130°C to +30°C; informational, available through the environment API |
| Dust | None / Low / Medium / High / Dust storm; particle count and visibility |

**Realistic Mars** uses 3.71 m/s², approximately 0.016 kg/m³, and a representative −63°C. These are general reference values, not weather measurements for this region or image-acquisition date. NASA's [planetary parameters](https://ssd.jpl.nasa.gov/planets/phys_par.html) support the gravity value; its [Mars fact sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) gives the approximate near-surface atmospheric density. Wind, temperature at this point, friction, softness and dust settings are illustrative tuning parameters. **Earth Physics** and **Moon-like** change the environment on the same Martian terrain; they do not change the dataset or reconstruct those worlds.

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

The HiRISE RED image is a single grayscale band. The warm material tint is illustrative, not measured true color. Decorative tiny rocks and material grain are also illustrative and explicitly documented. **Terrain & data** in the HUD exposes sources, bounds, resolutions, datum, attribution and transformations.

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

Validation includes 19 passing deterministic tests (original PDS sample values, exact collision triangles, measured-terrain traversal/jumps/sliding, environment updates) and a passing Playwright acceptance flow. The browser flow enters pointer lock, walks on the real terrain, compares Mars/Earth jumps, looks and inspects, toggles F3, changes wind/dust/softness/friction, and verifies particle and fog response. Browser-measured jump samples were approximately **1.52 m / 1.82 s** on Mars and **0.57 m / 0.69 s** on Earth.

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

`E` casts a camera-center ray to the actual terrain mesh and reports coordinates, areoid elevation, local triangular slope and available source information. This query path can later sample mineral/geology rasters in the same projection.

## Known simplifications and performance

- DEM downsampling omits detail below about 6 m. Triangular interpolation does not invent higher-resolution measurements. Mesh normals are smoothed for lighting; scientific/contact normals are the actual triangle normals.
- No terrain overhangs or caves; no general rigid-body object collisions. Illustrative pebbles are small visual dressing, without individual colliders or mapped geological positions.
- Global friction/softness values are user-defined, not spatial geological measurements. Sliding uses a simplified Coulomb model; no foot biomechanics, deformable soil or pressure-dependent regolith mechanics.
- Orbital imagery contains acquisition shadows. Added sunlight is visual and is not a reconstructed illumination epoch. Sky, dust and fog are artistic browser approximations, not atmospheric circulation or radiative-transfer simulations.
- The local plane omits planetary curvature and has a bounded edge. The player cannot move outside the measured crop. Temperature is currently informational.
- Nominal speeds (4.3 m/s walk, 7 m/s sprint before soil/slope effects) are FPS tuning values. No oxygen, life support, fatigue or suit model is included.
- Rendering uses one indexed terrain mesh, one instanced pebble mesh, at most 650 dust particles, a 4096² JPEG, a 1024² local shadow map and pixel ratio capped at 1.5. This region does not need a global tile/LOD system.
- Software WebGL can be slow. Use hardware acceleration for normal play. Long rendering stalls cap catch-up time to keep input and collision stable; simulation time may lag wall time on severely underpowered devices. FPS is displayed only in F3 mode.
- The intended acceptance target is a modern laptop. Headless acceptance checks verify behavior using software WebGL; they do not certify a hardware frame-rate benchmark.
# mars-simulation
