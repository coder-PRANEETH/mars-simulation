# Imported 3D models

## Astronaut

- Artist: **Quaternius**.
- Source and download page: https://poly.pizza/m/3hC2i0CTuO
- Download: https://static.poly.pizza/0076345b-bbea-42d5-931c-4a5ad2050b18.glb
- Licence: **CC0 1.0 Universal**, as displayed on the model's author listing: https://creativecommons.org/publicdomain/zero/1.0/
- Local file: `astronaut.glb`.
- The source GLB is unchanged. Runtime adjustments normalize the character's height to 1.85 m, align the animated boots with the collision body's feet, orient the character to the controller, blend idle/walk/run clips, and add an airborne leg pose. Movement and jumping come from the simulator's existing physics. No combat animation is exposed.

## Mars 2020 Perseverance rover

- Credit: **NASA/JPL-Caltech**.
- Official source page: https://science.nasa.gov/3d-resources/mars-2020-perseverance-rover/
- Download: https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/model/mars-2020-perseverance-rover/Mars%202020%20Perseverance%20Rover.glb
- Usage guidelines: https://www.nasa.gov/nasa-brand-center/images-and-media/
- Local file: `perseverance.glb`.
- The source GLB is unchanged. Runtime adjustments bake the supplied deployed mast pose, orient the model to the controller, separate its combined wheel mesh into six independently animated wheels, and reduce expensive glass effects for browser rendering. Source textures and geometry are retained; static pieces sharing a material are combined to reduce draw calls. Existing fast exploration speeds and simplified handling are game settings, not Perseverance mission performance or a validated rocker-bogie suspension simulation. NASA does not endorse this project.

## Draco decoder

The local Draco WebAssembly decoder and wrapper are distributed with Three.js and are licensed under Apache 2.0. The accompanying full licence is in `draco/LICENSE`. Source: https://github.com/google/draco . The files are bundled locally so loading the rover does not depend on an external decoder service.

Assets downloaded 2026-11-15. Actual model SHA-256 hashes are recorded in `hashes.json`.
