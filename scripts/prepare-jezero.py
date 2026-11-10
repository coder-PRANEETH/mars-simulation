"""Prepare browser-sized, aligned data from official USGS Jezero products."""
import json
from pathlib import Path

import numpy as np
from PIL import Image
import rasterio
from rasterio.windows import from_bounds
from pyproj import CRS, Transformer
from raster_samples import samples as remote_samples

ROOT = Path(__file__).resolve().parents[1] / "public" / "jezero"
USGS = "https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/"
TRN = USGS + "mars2020_trn/"
DEM = TRN + "HiRISE/JEZ_hirise_soc_006_DTM_MOLAtopography_DeltaGeoid_1m_Eqc_latTs0_lon0_blend40.tif"
ORTHO = TRN + "HiRISE/JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first.tif"
CTX = TRN + "CTX/ScienceInvestigationMaps_JPL/M20_JezeroCrater_CTXDEM_20m.tif"
THEMIS = USGS + "Mars_MO_THEMIS-IR-Night_mosaic_60N60S_100m_v14.tif"
# Longitude and latitude in the source's east-positive, planetocentric frame.
DETAIL = (77.357, 18.422, 77.458, 18.480)
CRATER = (77.22, 18.00, 78.16, 18.82)
STRIDE = 8


def converter(raster, inverse=False):
    projected = CRS.from_wkt(raster.crs.to_wkt())
    pair = (projected, projected.geodetic_crs)
    return Transformer.from_crs(*(pair if inverse else pair[::-1]), always_xy=True)


def window_for(raster, bounds):
    west, south, east, north = bounds
    project = converter(raster).transform
    return from_bounds(*project(west, south), *project(east, north), raster.transform)


def bounds_for(raster, west, south, east, north):
    degrees = converter(raster, inverse=True).transform
    return (*degrees(west, south), *degrees(east, north))


def product(path):
    return rasterio.open(path)


def read_samples(raster, window, height, width):
    rows = np.floor(window.row_off + (np.arange(height) + 0.5) * window.height / height).astype(int)
    columns = np.floor(window.col_off + (np.arange(width) + 0.5) * window.width / width).astype(int)
    values = remote_samples(raster.name, rows, columns)
    return np.ma.array(values, mask=~np.isfinite(values) | (values == raster.nodata))


def stretched(values):
    valid = values.compressed()
    low, high = np.percentile(valid, (2, 98))
    return np.clip(255 * (values.filled(low) - low) / max(high - low, 1e-8), 0, 255).astype("uint8")


def write_json(name, value):
    (ROOT / name).write_text(json.dumps(value, indent=2) + "\n")


def detail():
    with product(DEM) as raster:
        window = window_for(raster, DETAIL).round_offsets()
        width = int(window.width - 1) // STRIDE * STRIDE + 1
        height = int(window.height - 1) // STRIDE * STRIDE + 1
        rows = np.arange(int(window.row_off), int(window.row_off) + height, STRIDE)
        columns = np.arange(int(window.col_off), int(window.col_off) + width, STRIDE)
        elevations = remote_samples(raster.name, rows, columns)
        invalid = ~np.isfinite(elevations) | (elevations == raster.nodata)
        if invalid.any():
            raise ValueError(f"The detail crop has {invalid.sum()} missing elevation posts.")
        west, north = raster.xy(window.row_off, window.col_off)
        east, south = raster.xy(window.row_off + height - 1, window.col_off + width - 1)
        geographic_bounds = bounds_for(raster, west, south, east, north)
        longitude_west, latitude_south, longitude_east, latitude_north = geographic_bounds
        center_latitude = (latitude_south + latitude_north) / 2
        scale = np.cos(np.radians(center_latitude))
        width_meters = (east - west) * scale
        depth_meters = north - south

    print("Detail bounds:", geographic_bounds, elevations.shape, flush=True)
    with product(ORTHO) as raster:
        ortho_window = window_for(raster, geographic_bounds)
        texture_size = 2048
        image = read_samples(raster, ortho_window, texture_size, texture_size)
        if np.ma.count_masked(image):
            raise ValueError("The imagery crop contains gaps.")
        Image.fromarray(stretched(image)).save(ROOT / "texture.jpg", quality=88, optimize=True)

    rows, columns = elevations.shape
    offset = float(np.median(elevations))
    (elevations - offset).astype("<f4").tofile(ROOT / "heights.bin")
    # Place the demo spawn on a measured, locally gentle part of the center patch.
    dz, dx = np.gradient(elevations, depth_meters / (rows - 1), width_meters / (columns - 1))
    row, col = np.indices(elevations.shape)
    cost = (row - rows // 2)**2 + (col - columns // 2)**2
    spawn_row, spawn_col = np.unravel_index(np.argmin(np.where(np.hypot(dx, dz) < 0.08, cost, np.inf)), cost.shape)
    write_json("metadata.json", {
        "name": "Jezero Western Delta",
        "region": "Jezero Crater / Western Delta",
        "datasetName": "Mars 2020 Terrain Relative Navigation HiRISE mosaics",
        "credit": "USGS Astrogeology / NASA / JPL-Caltech / University of Arizona",
        "columns": columns, "rows": rows,
        "widthMeters": width_meters, "depthMeters": depth_meters,
        "areaKm2": width_meters * depth_meters / 1e6,
        "elevationOffset": offset,
        "minimumElevation": float(elevations.min()), "maximumElevation": float(elevations.max()),
        "elevationDatum": "USGS TRN product, MOLA topography / DeltaGeoid",
        "centerLatitude": center_latitude, "centerLongitude": (longitude_west + longitude_east) / 2,
        "latitudeNorth": latitude_north, "latitudeSouth": latitude_south,
        "longitudeWest": longitude_west, "longitudeEast": longitude_east,
        "originalResolutionMeters": 1, "originalImageryResolutionMeters": 0.25,
        "meshResolutionMeters": STRIDE, "textureSize": texture_size,
        "spawn": {"x": (spawn_col / (columns - 1) - 0.5) * width_meters,
                  "z": (spawn_row / (rows - 1) - 0.5) * depth_meters, "yaw": 1.15},
        "surfaceInformation": "HiRISE orbital terrain. Small rocks, footing and weather require field observations.",
        "sources": [
            {"name": "HiRISE elevation mosaic", "url": DEM},
            {"name": "HiRISE orthorectified image mosaic", "url": ORTHO},
        ],
        "transformations": [
            f"Retained every {STRIDE}th measured post in the overlap crop. Elevation has no vertical exaggeration.",
            "Converted map x spacing to local east-west ground metres at the center latitude.",
            "Sampled the aligned imagery to a browser-sized texture and stretched the grayscale display.",
        ],
    })


def overview():
    with product(CTX) as raster:
        window = window_for(raster, CRATER)
        height = 832
        width = round(height * window.width / window.height * np.cos(np.radians(18.41)))
        values = read_samples(raster, window, height, width)
        terrain = stretched(values).astype(float) / 255
        dz, dx = np.gradient(values.filled(0))
        shade = np.clip(0.68 + (dx + dz) / 65, 0.33, 0.95)
        rgb = (np.stack([terrain * 108 + 83, terrain * 91 + 57, terrain * 70 + 43], axis=-1)
               * shade[..., None]).astype("uint8")
        rgb[np.ma.getmaskarray(values)] = [22, 25, 29]
        Image.fromarray(rgb).save(ROOT / "crater.jpg", quality=88, optimize=True)
    write_json("crater.json", {"bounds": CRATER, "width": width, "height": height, "source": CTX})


def thermal():
    with product(THEMIS) as raster:
        window = window_for(raster, CRATER)
        values = read_samples(raster, window, round(window.height), round(window.width))
        ir = stretched(values).astype(float) / 255
        colors = np.stack([55 + 200 * ir, 55 + 135 * ir, 112 + 15 * ir], axis=-1).astype("uint8")
        alpha = np.where(np.ma.getmaskarray(values), 0, 212).astype("uint8")
        Image.fromarray(np.dstack([colors, alpha])).save(ROOT / "thermal.png", optimize=True)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("product", choices=("detail", "overview", "thermal"))
    ROOT.mkdir(parents=True, exist_ok=True)
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", GDAL_HTTP_MAX_RETRY="3", GDAL_HTTP_TIMEOUT="30"):
        {"detail": detail, "overview": overview, "thermal": thermal}[parser.parse_args().product]()
