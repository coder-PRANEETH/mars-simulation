#!/usr/bin/env python3
"""Rebuild the shipped Mars terrain from the original NASA HiRISE PDS products.

Python 3.10+; pip install -r scripts/terrain-requirements.txt
python scripts/prepare-terrain.py --cache .cache/mars-source

No procedural terrain, vertical exaggeration, or fitted/generated elevation is used.
The default is a completely valid 1201 x 1201-post crop of the 2.0194 m DTM.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
from urllib.request import urlopen

import numpy as np
import rasterio
from PIL import Image
from rasterio.enums import Resampling
from rasterio.windows import Window, from_bounds

BASE = "https://www.uahirise.org/PDS/DTM/ESP/ORB_042300_042399/ESP_042328_1985_ESP_033150_1985/"
DTM = "DTEED_042328_1985_033150_1985_A01.IMG"
ORTHO = "ESP_042328_1985_RED_B_01_ORTHO.JP2"
LABEL = "ESP_042328_1985_RED_B_01_ORTHO.LBL"
PROJECT = Path(__file__).resolve().parents[1]


def download(name: str, cache: Path) -> Path:
    path = cache / name
    if not path.exists():
        print(f"Downloading {name}", flush=True)
        with urlopen(BASE + name, timeout=180) as response, path.open("wb") as target:
            while chunk := response.read(1024 * 1024):
                target.write(chunk)
    return path


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, default=PROJECT / ".cache/mars-source")
    parser.add_argument("--output", type=Path, default=PROJECT / "public/terrain")
    parser.add_argument("--row", type=int, default=2900, help="Zero-based first DEM row")
    parser.add_argument("--column", type=int, default=1200, help="Zero-based first DEM column")
    parser.add_argument("--span", type=int, default=1200, help="Number of source intervals across crop")
    parser.add_argument("--stride", type=int, default=3, help="Measured source-post decimation stride")
    parser.add_argument("--texture-size", type=int, default=4096)
    args = parser.parse_args()
    if args.span % args.stride:
        raise ValueError("span must be divisible by stride")
    args.cache.mkdir(parents=True, exist_ok=True)
    args.output.mkdir(parents=True, exist_ok=True)
    dem_path, ortho_path, label_path = [download(name, args.cache) for name in [DTM, ORTHO, LABEL]]

    with rasterio.open(dem_path) as dem:
        if args.row < 0 or args.column < 0 or args.row + args.span >= dem.height or args.column + args.span >= dem.width:
            raise ValueError("Crop is outside source raster")
        window = Window(args.column, args.row, args.span + 1, args.span + 1)
        source = dem.read(1, window=window)
        valid = np.isfinite(source) & (source > -1e10)
        if not valid.all():
            raise ValueError("Selected crop contains missing DEM posts; choose a valid smaller crop")
        # Retain genuine measured posts, including both exact crop endpoints.
        elevations = source[::args.stride, ::args.stride].astype(np.float32)
        source_resolution = float(dem.transform.a)
        width = depth = args.span * source_resolution
        west, north = dem.xy(args.row, args.column)
        east, south = dem.xy(args.row + args.span, args.column + args.span)
        center_x, center_y = (west + east) / 2, (north + south) / 2
        radius = 3394839.8133163
        longitude_origin, standard_parallel = 78.21, 15.0

        def coordinate(x: float, y: float) -> tuple[float, float]:
            return math.degrees(y / radius), longitude_origin + math.degrees(x / (radius * math.cos(math.radians(standard_parallel))))

        center_lat, center_lon = coordinate(center_x, center_y)
        north_lat, west_lon = coordinate(west, north)
        south_lat, east_lon = coordinate(east, south)
        elevation_offset = float(elevations[elevations.shape[0] // 2, elevations.shape[1] // 2])
        heights = elevations - elevation_offset
        heights.astype("<f4").tofile(args.output / "heights.bin")

    with rasterio.open(ortho_path) as ortho:
        # Use each product's georeferencing rather than assuming pixels share indexes.
        # DEM source-post centers are the exact four playable mesh corners.
        image_window = from_bounds(west, south, east, north, ortho.transform)
        image = ortho.read(1, window=image_window,
                           out_shape=(args.texture_size, args.texture_size),
                           resampling=Resampling.bilinear)
        if np.any(image == 0):
            raise ValueError("Selected orbital imagery crop contains missing pixels")
        original_imagery_resolution = float(ortho.transform.a)
        # A fixed linear percentile display stretch preserves the real image pattern.
        p1, p99 = [float(v) for v in np.percentile(image, [1, 99])]
        display = np.clip((image.astype(np.float32) - p1) / (p99 - p1), 0, 1)
        texture = np.round(display * 255).astype(np.uint8)
        Image.fromarray(texture).save(args.output / "texture.jpg", quality=92, optimize=True)
        preview = Image.fromarray(texture).resize((640, 640), Image.Resampling.LANCZOS)
        preview.save(args.output / "overview.jpg", quality=88, optimize=True)

    metadata = {
        "name": "HiRISE Jezero Southeast Hills",
        "region": "Hill southeast of Jezero Crater",
        "datasetName": "MRO Mars High Resolution Imaging Science Experiment DTM V1.0",
        "datasetId": "MRO-M-HIRISE-5-DTM-V1.0",
        "dtmProductId": DTM.removesuffix(".IMG"),
        "imageryProductId": ORTHO.removesuffix(".JP2"),
        "credit": "NASA/JPL-Caltech/University of Arizona",
        "columns": int(heights.shape[1]), "rows": int(heights.shape[0]),
        "widthMeters": width, "depthMeters": depth,
        "areaSquareKilometers": width * depth / 1e6,
        "areaKm2": width * depth / 1e6,
        "elevationOffset": elevation_offset,
        "minimumElevation": float(elevations.min()), "maximumElevation": float(elevations.max()),
        "elevationDatum": "Mars 2000 areoid (equipotential surface); meters above datum",
        "centerLatitude": center_lat, "centerLongitude": center_lon,
        "latitudeNorth": north_lat, "latitudeSouth": south_lat,
        "longitudeWest": west_lon, "longitudeEast": east_lon,
        "coordinateSystem": "Planetocentric latitude; east-positive longitude",
        "originalResolutionMeters": source_resolution,
        "originalImageryResolutionMeters": original_imagery_resolution,
        "meshResolutionMeters": source_resolution * args.stride,
        "textureResolutionMeters": width / args.texture_size,
        "textureSize": args.texture_size,
        "projection": {
            "type": "Equirectangular", "standardParallel": standard_parallel,
            "centerLongitude": longitude_origin, "radiusMeters": radius,
            "centerEastingMeters": center_x, "centerNorthingMeters": center_y,
        },
        "sourceCrop": {"row": args.row, "column": args.column, "rows": args.span + 1, "columns": args.span + 1},
        "source": "https://www.uahirise.org/dtm/ESP_042328_1985",
        "sources": [
            {"name": "HiRISE stereo DTM", "url": BASE + DTM, "sha256": sha256(dem_path)},
            {"name": "Co-registered HiRISE RED orthoimage", "url": BASE + ORTHO, "sha256": sha256(ortho_path)},
            {"name": "Orbital imagery PDS label", "url": BASE + LABEL, "sha256": sha256(label_path)},
            {"name": "HiRISE DTM product documentation", "url": "https://www.uahirise.org/dtm/about.php"},
        ],
        "transformations": [
            f"Crop zero-based DTM rows {args.row}–{args.row + args.span}, columns {args.column}–{args.column + args.span}; all source posts valid.",
            f"Retain every {args.stride}rd measured DEM post: {heights.shape[1]} × {heights.shape[0]} vertices at {source_resolution * args.stride:.6f} m spacing. No synthetic elevation or vertical exaggeration.",
            f"Subtract {elevation_offset:.6f} m from elevation to keep renderer coordinates near zero. Restore this offset for scientific altitude.",
            f"Georeferenced co-registered {original_imagery_resolution:.6f} m/pixel RED orthoimage cropped to the same DEM-post-center bounds; bilinear resize to {args.texture_size} × {args.texture_size}.",
            f"Single-band RED image linearly stretched using crop 1st/99th percentile DN ({p1:.1f}, {p99:.1f}) and JPEG compressed at quality 92. Rust material tint is illustrative, not measured true color.",
        ],
        "surfaceInformation": "Orbital morphology only. Rock, regolith and mineral properties are not measured by this prototype.",
        "simplifications": [
            "Mesh interpolation gives a planar triangular surface between retained source posts; sub-grid obstacles are not resolved.",
            "Orbital image includes lighting and shadows from acquisition; it is not a corrected intrinsic-albedo map.",
            "Decorative instanced rocks and close-range material grain are illustrative props; locations are not mapped geological observations.",
            "Local equirectangular map plane is used at 1 m = 1 world unit; planetary curvature is omitted over this 2.42 km patch.",
        ],
        "spawn": {"x": 0, "z": -550, "yaw": 9 * math.pi / 8, "headingDegrees": 157.5},
        "encoding": "Float32 little endian; row 0 north, column 0 west; y = areoid elevation − elevationOffset",
        "triangleTopology": "northwest a, northeast b, southwest c, southeast d; triangles a,c,b and b,c,d",
        "preprocessingScript": "scripts/prepare-terrain.py",
    }
    (args.output / "metadata.json").write_text(json.dumps(metadata, indent=2) + "\n")
    raw_label = dem_path.open("rb").read(14044).decode("ascii").split("\r\nEND\r\n")[0] + "\nEND\n"
    (args.output / "dtm-label.txt").write_text(raw_label)
    (args.output / "imagery-label.txt").write_text(label_path.read_text())
    print(json.dumps({key: metadata[key] for key in ["region", "columns", "rows", "areaSquareKilometers", "centerLatitude", "centerLongitude", "minimumElevation", "maximumElevation"]}, indent=2))


if __name__ == "__main__":
    main()
