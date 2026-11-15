# Suggestions implementation and research notes

Source brief: `suggestions.pdf` supplied by the project owner. Its proposals were implemented under the user's direct instruction; its closing request to discuss priorities was context, not an additional approval gate.

## Feature coverage

| PDF request | Implementation | Verification |
| --- | --- | --- |
| Almost full-screen Route map | Terrain occupies the viewport behind floating controls | Desktop/phone workspace checks |
| Collapsible desktop planner | Collapse/expand on desktop and phone, preserving state | Workspace checks |
| Compact floating layers | Independent Layers popup, key describes enabled layers | Existing and regional browser checks |
| Compact distance/time/energy/risk summary | Persistent four-metric Route Summary | Summary labels checked |
| Slopes, hazards, geology, sites and routes on map | Registered elevation/slope rasters, vector geology, separate cover, markers and route lines | Layer and inspector checks |
| Entire Western Delta and surroundings | 373.1 km² measured CTX mesh and imagery | All elevations finite; bounding/projection checks |
| Zoom-dependent imagery detail | Regional overview → regional image → registered HiRISE inset; native extent selector for finer elevation analysis | Imagery-level and pin-preservation browser check |
| Detailed Stack field-site geology | Actual GIS supplement; 15 bedrock units and six separate cover classes | Asset registration and known-coordinate checks |
| Surface observations and geological hypotheses | Distinct observations/2020 interpretation, alternative origins, source/epoch disclosure | Selected-region browser check |
| Delta/floor/margin contact and exposed-outcrop priorities | Derived two-cell transects crossing real mapped boundaries; exclude major mapped cover; annotate route crossings | Synthetic contact and cover-exclusion tests; real regional example |
| Terrain-dependent astronaut mobility | Shared pace/grade/terrain law in route estimates and budgeted walking | Equation and deterministic physics checks |
| Metabolic energy, oxygen and cooling | Integrated effort, delayed metabolic response, oxygen conversion, residual heat and reserve budgets | Energy/cooling conservation and forecast tests |
| Investigate advanced human models | Optional Pandolf Earth baseline, explicit limitations and linked NASA research | Independent numerical equation checks |
| Integrate geology, physiology and science routing | Energy A*, user-specific mass/model settings, science-benefit/effort scoring and enabled supply feasibility | Detour, budget and browser integration checks |
| Review MOMAR and differentiate | Primary-site comparison below, focused implementation decision | Sources reviewed, no MOMAR code copied |

## MOMAR comparison and product direction

[MOMAR's own documentation](https://www.momar.si/how-it-works/) describes terrain-risk routing with Theta* and A* fallback, an Earth hiking-speed law, mineral indicators, and 3D playback. Its risk layers include slope, roughness, sand and data quality. These are useful reference capabilities, not evidence of validated suited-Mars performance or confirmed mineral identifications.

The simulator's focus is the connection between detailed mapped geology, astronaut effort and the science worth pursuing with a finite suit budget. The work therefore adds exposed-contact transects, effort-aware route alternatives and user-specific oxygen/thermal checks. It retains the existing A* engine and interactive rover/walking simulation. MOMAR source code, visual design and branding were not copied. CRISM mineral classification, a new global tile service and Theta* were not requested as standalone new deliverables; the PDF describes them as competitor background.

## Map provenance and limits

The broader mesh uses the official CTX 20 m elevation product sampled at 40 m, paired with the 6 m optical mosaic. The local analysis option retains the existing HiRISE-derived 8 m mesh. Display textures are reduced for browser performance. The close-zoom HiRISE image inset improves optical context only; it does not turn the regional mesh into 1 m elevation data. Grid spacing and coverage remain visible. There is no invented DEM outside the valid crop.

The [Stack et al. field map](https://doi.org/10.1007/s11214-020-00739-x) contains independent bedrock and surficial-cover attributes. Those attributes remain separate from each other and from [USGS SIM 3464](https://pubs.usgs.gov/publication/sim3464). The published field map supplies 15 bedrock classes; only six intersect the smaller HiRISE crop. Source polygons are rasterized unsimplified; display boundaries use up to 5 m simplification. These pre-landing interpretations are not silently replaced by later rover findings. Source attributions, current publisher CC BY 4.0 licence and transformations appear in the processed metadata.

Contact transects are potential observation objectives. Comparing bedding, truncation, superposition and cover on both sides may help test relative-age hypotheses. A mapped boundary does not establish a universally dated sequence, prove habitability, guarantee visible rock at a 40 m cell, or certify safe access. Route descriptions flag map crossings without asserting an exact geological age or new mineral detection.

## Human mobility and effort models

Two selectable models are available:

1. **Mars mission reference:** the existing 350 W level-ground reference with explicitly illustrative speed, mass, terrain and grade response curves.
2. **Pandolf Earth load carriage:** `1.5W + 2(W+L)(L/W)^2 + η(W+L)(1.5V² + 0.35VG)`, with body mass W and carried load L in kg, speed V in m/s and G in percent grade. η is an illustrative terrain multiplier. Downhill uses the level-ground grade term; we do not implement an uncertain downhill correction from a text-extraction artifact.

[Pandolf et al. (1977)](https://doi.org/10.1152/jappl.1977.43.4.577) is an Earth empirical load-carriage model. [Kim et al., NASA 2024](https://ntrs.nasa.gov/citations/20240001423) explores metabolic prediction with downhill and adaptation-delay treatment in terrestrial field activity. This motivates an optional baseline and delayed workload response here; it does **not** validate this simulator on Mars. The cited NASA field study involved four healthy adults. No suit-joint resistance, pressure-volume work, muscle activation or measured Mars physiological parameters are inferred.

The first-order response is `dR/dt = (target − R)/τ`; each segment integrates its exponential response analytically. Default τ = 30 s is a configurable design assumption. Zero disables the delay. Recovery continues to consume energy and generate heat. Cooling is integrated through its possible crossing with demand; spare cooling cannot be banked as negative stored heat. Model heat storage is not a predicted core temperature.

Shared budgeted walking speed is `pace / (terrainFactor + 3·uphillGrade + downhillGrade)`. Route and live walking use this law; the walking controller converts along-surface speed to horizontal speed. Directional slope is measured from the same terrain triangles. The terrain factor derives from registered cover/bedrock handling and roughness; these coefficients remain educational assumptions. Acceleration, blending and real-time input cause local differences from the discrete planned traverse. Ordinary unbudgeted game walking remains faster.

The supplied Norcross NASA-TP-2010-216115 study informs awareness of suit/mass/gravity effects but does not calibrate a validated suited-Mars prediction; its tested reduced-gravity conditions and task setup must not be presented as an in-field Jezero validation. Reduced gravity affects gait/physics, without an unsupported linear rescaling of metabolic energy. Leg-length/Froude estimates indicate a possible gait transition, not a safety or efficiency guarantee.

Oxygen uses the existing 20.19 kJ per STPD litre conversion and excludes system losses. Cooling is constant and omits radiative/environmental heat and detailed thermoregulation. The reserve, oxygen supply, task rates and shelter-return scenario are user-adjustable model choices. Live telemetry retains only wind, temperature, coordinates and speed; the optional suit display separately reports model estimates.

## Routing decisions and honest optimality

- **Easier terrain** minimizes the existing nonnegative terrain-risk travel cost and respects slope and avoid constraints.
- **Save your energy** uses A* with directed, steady metabolic joules along both triangle portions of each edge. Its admissible heuristic uses resting effort × straight-line distance / nominal pace. It uses the selected body/suit masses and effort model. Forecast energy then includes workload lag and planned science; it is **not** a proof of global optimality for a history-dependent physiological state.
- **Science stop** evaluates available mapped sites and a bounded set of nearby exposed contact candidates. A transect forces the path to both sides of its mapped contact. The heuristic score is priority / (1 + extraEnergy/250 kJ + extraTime/1800 s + relativeRisk). Priorities, scales and candidate caps are team planning choices, not NASA scientific rankings. This is a best-candidate comparison, not exhaustive tour optimization.
- Enabling the suit budget excludes science candidates that fail the full return/reserve/heat forecast. Other routes still show their budget result so the user can revise assumptions or drive. A route risk score is a relative index, not an injury probability or a certified safety assessment.
- Return bands use a conservative allowance for residual metabolic demand; the final excursion forecast integrates the actual reverse segment order. Returning in the live suit model follows recorded footsteps, not an invented shortcut.

## Validation

The automated checks cover source-grid registration, valid wider elevation coverage, all 15 units and six covers, equation units/percent grade, exact delayed energy and cooling conservation, a longer route that saves effort, science contact crossings/cover exclusion, supply rejection, correct map-to-world start placement and desktop/phone interactions. Browser checks also retain rover slip/sinking/steering, free-cursor controls, live telemetry fields and hazard/land-type minimap behavior.

These checks establish software consistency. They do not certify real astronaut physiology, wheel terramechanics, operational safety or a hardware frame-rate target. Software WebGL runs substantially slower than normal hardware rendering.

## Rebuilding the added datasets

Use the existing `scripts/terrain-requirements.txt` and `scripts/geology-requirements.txt` in a Python environment. Download the two official CTX TIFFs linked in the regional metadata, the [Stack et al. GIS supplement](https://static-content.springer.com/esm/art%3A10.1007%2Fs11214-020-00739-x/MediaObjects/11214_2020_739_MOESM3_ESM.zip), and the existing USGS SIM 3464 geodatabase. Keep source downloads outside `public`; only processed assets ship.

```sh
python scripts/prepare-western-delta.py \
  --dem /path/to/M20_JezeroCrater_CTXDEM_20m.tif \
  --image /path/to/JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0.tif \
  --usgs-gdb /path/to/Nili.gdb --output public
python scripts/prepare-field-geology.py \
  /path/to/M2020_JEZ_geology_edited_equi0_allquads_v6_archive.shp \
  --public-root public
```

The original fine Jezero assets must already exist for the second command's default two-region registration. The first command also copies the archived weather, thermal and crater context used by the regional view. Validate generated heights, grid lengths, mapped-unit counts and coordinate registration with `npm test` before committing assets.

Final verification (2026-11-15): production build passed; all 14 automated test files passed; all 17 browser acceptance checks passed. After final label/waypoint readability adjustments, the five regional/workspace/zoom checks passed again. The research-routing check also verifies automatic fallback when a selected science route becomes infeasible. Desktop and phone screenshots were reviewed with zero browser errors and no horizontal overflow.
