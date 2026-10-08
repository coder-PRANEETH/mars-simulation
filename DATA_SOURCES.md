# Mars terrain provenance

The playable terrain is a real measured **5.8723 km²** crop of the hill southeast of Jezero Crater. No random noise, invented craters, fitted topography, or elevation exaggeration is used for the primary terrain.

## Original public data

Dataset: **MRO Mars High Resolution Imaging Science Experiment DTM V1.0** (`MRO-M-HIRISE-5-DTM-V1.0`). Instrument: HiRISE on NASA's Mars Reconnaissance Orbiter. Terrain producer: University of Arizona, Alfred McEwen and Kris Amanda Akers. Credit: **NASA/JPL-Caltech/University of Arizona**.

Product landing page: [Hill Southeast of Jezero Crater](https://www.uahirise.org/dtm/ESP_042328_1985). [HiRISE DTM documentation](https://www.uahirise.org/dtm/about.php) describes the stereo-reconstruction process, resolutions, known artifacts and product naming. [Original PDS directory](https://www.uahirise.org/PDS/DTM/ESP/ORB_042300_042399/ESP_042328_1985_ESP_033150_1985/).

| Asset | Exact original product | Original resolution | Original dimensions |
| --- | --- | --- | --- |
| Elevation | [DTEED_042328_1985_033150_1985_A01.IMG](https://www.uahirise.org/PDS/DTM/ESP/ORB_042300_042399/ESP_042328_1985_ESP_033150_1985/DTEED_042328_1985_033150_1985_A01.IMG) | 2.0194076293477 m per post | 3511 × 8457 |
| Orbital surface image | [ESP_042328_1985_RED_B_01_ORTHO.JP2](https://www.uahirise.org/PDS/DTM/ESP/ORB_042300_042399/ESP_042328_1985_ESP_033150_1985/ESP_042328_1985_RED_B_01_ORTHO.JP2) | 0.50485190733684 m/pixel | 14043 × 33826 |
| Image metadata | [ESP_042328_1985_RED_B_01_ORTHO.LBL](https://www.uahirise.org/PDS/DTM/ESP/ORB_042300_042399/ESP_042328_1985_ESP_033150_1985/ESP_042328_1985_RED_B_01_ORTHO.LBL) | PDS3 detached label | — |

The DTM is a float32 `PC_REAL` raster with an embedded PDS3 label. Image values are elevations in meters above the **Mars 2000 areoid/equipotential datum**, according to its original label. The two source stereo observations are `ESP_042328_1985` and `ESP_033150_1985`. The matched orthoimage was reconstructed from `ESP_042328_1985` using the same DTM, so imagery and measured relief share a projection. The image is a **single RED-filter band**, not measured full-color imagery. A warm material tint in the renderer is illustrative.

Copies of the original relevant labels are shipped as `public/terrain/dtm-label.txt` and `public/terrain/imagery-label.txt`. SHA-256 hashes of the downloaded source files are recorded in `public/terrain/metadata.json`.

## Exact region and coordinate conventions

- Center: **18.180813991576° N, 78.209876504366° E**.
- North/south: **18.201263298284° N / 18.160364684868° N**.
- West/east: **78.188705824225° E / 78.231047184506° E**.
- Size: **2423.289155 m × 2423.289155 m**; area **5.872330 km²**.
- Retained elevations: **−875.444824 m to −481.208954 m** above the Mars 2000 datum. Negative altitude is valid and means below the areoid.
- Coordinates use **planetocentric latitude and east-positive longitude**.
- Equirectangular projection, standard parallel 15°, central meridian 78.21°, local spherical radius 3,394,839.8133163 m, as specified in the original label. Projection center latitude is not the crop center latitude.

The local game plane follows the original projected raster, with one world unit equal to one meter: +x east, +z south, +y up. Coordinates reported by inspection use the source projection's inverse equations. Planetary curvature is omitted over this small region.

The default player starts on a gentle 4.4° bench at local x=0 m, z=−550 m, approximately 46 m below the central hill datum post, facing southeast toward measured ridges. Along the initial heading, the real terrain rises approximately 17 m over 100 m and 38 m over 200 m, so hill relief is visible at human eye height.

## Transformations

1. Download the original DTM (118,784,152 bytes) and higher-resolution matched RED orthoimage (110,693,767 bytes) plus its PDS label. Originals are preprocessing inputs and are not required to run the app.
2. Crop zero-based DTM **rows 2900–4100 and columns 1200–2400 inclusive**. The complete 1201 × 1201-post source crop contains valid measured elevations: no hole filling or procedural replacement was needed.
3. Retain **every third measured source post**, including both endpoints. The packaged mesh is **401 × 401 vertices**, with **6.0582228880431 m** spacing and 320,000 triangles. Intermediate surfaces are flat triangles, rather than claims of extra measured detail.
4. Subtract the center-post areoid elevation, **−497.99560546875 m**, from every elevation to keep rendering coordinates near zero. This is an origin translation only: **vertical exaggeration = 1**. The offset is restored for inspection and diagnostic scientific elevation; the main HUD altitude instead measures player height above the local ground.
5. Crop the orthoimage to the exact geographic bounds of the DEM-post-center corners, using each product's georeferencing. Bilinear resize it to **4096 × 4096**, approximately **0.591623 m/pixel**.
6. Apply a linear 1st–99th percentile contrast stretch to the actual grayscale RED pixel values, then JPEG-compress at quality 92. This improves display contrast; it is not a calibrated reflectance product. Texture content remains real orbital imagery.
7. Write `heights.bin` as little-endian float32 in north-to-south row order and west-to-east column order. `metadata.json` records transformation details, map projection, provenance and checksums. `overview.jpg` is a 640 × 640 reduced preview of the same crop.

There is no generated global terrain surrounding the playable patch. Any close-range material grain or instanced rocks are decorative detail and are not measured rock positions. Shadows already visible in the orbital photograph are part of the acquisition image; this prototype does not remove them to estimate intrinsic surface albedo.

## Rebuild the static assets

The application runs with `npm install` and `npm run dev`; Python is needed only to rebuild or replace terrain.

```bash
python -m venv .venv-terrain
source .venv-terrain/bin/activate
pip install -r scripts/terrain-requirements.txt
python scripts/prepare-terrain.py --cache .cache/mars-source
```

The script downloads missing original products, rejects any crop containing missing DEM values, and writes the static assets. To select another valid patch from this same source, change `--row`, `--column`, `--span`, and `--stride`; `--span` must be divisible by `--stride`. Example:

```bash
python scripts/prepare-terrain.py --row 3000 --column 1300 --span 1200 --stride 3
```

To use a different Mars DEM, update the source URLs/product IDs and projection constants in the preprocessing script, read its actual raster georeferencing, and select a valid crop. Download a matching orthorectified image with the same CRS or reproject it to the DEM bounds. Verify the datum, missing-value encoding, units and scale from the product labels; do not assume all PDS rasters use the same conventions. Output the existing `metadata.json`/`heights.bin` contract so the terrain renderer, collision and environmental queries continue to share the same surface. Do not silently fill missing source posts with invented terrain.

## Runtime terrain contract

`loadTerrain()` in `src/terrain/terrain.js` supplies metadata, heights and shared `sampleHeight`, `sampleNormal`, `sampleSlope`, `coordinates`, `getElevation` and `contains` queries. Triangles are northwest/southwest/northeast (`a,c,b`) and northeast/southwest/southeast (`b,c,d`); sampling uses exactly these planar triangles. This keeps collision, scientific slope and visual topography aligned. A future rover should use the same sampled surface and central environment state for its wheel contacts, rather than an invisible flat plane.
