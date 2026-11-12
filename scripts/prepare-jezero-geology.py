"""Clip SIM 3464 boundaries and register geology IDs to each terrain mesh cell."""
import argparse
import json
from pathlib import Path

import numpy as np
from pyogrio.raw import read
from pyproj import CRS, Transformer
from rasterio.features import rasterize
from rasterio.transform import from_bounds
import shapely
from shapely.geometry import box

PUBLIC = Path(__file__).resolve().parents[1] / "public"
SOURCE = "https://pubs.usgs.gov/publication/sim3464"
COLORS = (
    "#62a895", "#d4a76e", "#c88a60", "#a084c1", "#668fc1", "#b6bd72", "#bf7569",
    "#d3a849", "#92849c", "#a6bbbf", "#779688", "#8e7a76", "#a89174", "#c296a1",
)
# Short educational summaries of the published morphology, not strength measurements.
UNITS = {
    0: ("Delta layers", "layered-rock", "Layered fan deposits left by ancient rivers in Jezero crater."),
    1: ("Older delta layers", "layered-rock", "A lower, older fan deposit inside Jezero crater."),
    2: ("Crater-floor rock", "floor-rock", "Crater-floor exposures with varied textures and patches of overlying material."),
    3: ("Lower etched rock", "etched-rock", "An eroded, olivine-bearing unit below the upper etched rocks."),
    4: ("Nili fan deposit", "layered-rock", "Fan-shaped deposits in the Nili Planum region."),
    5: ("Nili upper plains", "broken-rock", "Lobate-edged, boulder-shedding exposures that often cap older units."),
    6: ("Nili lower plains", "mixed-rock", "Older plains with smooth, rugged and mound-forming textures."),
    7: ("Wind-blown sand", "sand", "Wind-shaped ridges of loose sediment called eolian bedforms."),
    8: ("Smooth surface cover", "loose-cover", "Smooth deposits in low areas and on slopes; their origin varies."),
    9: ("Rugged bright rock", "broken-rock", "Light-toned, rugged exposures and mounds."),
    10: ("Upper etched rock", "etched-rock", "Eroded rocks with ridged, cratered and rugged surface textures."),
    11: ("Crater rim", "broken-rock", "Impact-related rocks forming crater rims and terraced walls."),
    12: ("Impact debris", "broken-rock", "Material thrown out around an impact crater."),
    13: ("Crater interior", "mixed-rock", "Bedrock exposed in the interior of an impact crater."),
}


def read_layer(database, layer, fields, extent, tolerance):
    meta, _, shapes, attributes = read(database, layer=layer, columns=fields)
    crs = CRS.from_wkt(meta["crs"])
    to_lonlat = Transformer.from_crs(crs, crs.geodetic_crs, always_xy=True)
    to_projected = Transformer.from_crs(crs.geodetic_crs, crs, always_xy=True)
    bounds = box(*to_projected.transform_bounds(*extent))
    for raw, *values in zip(shapes, *attributes):
        if raw is None:
            continue
        geometry = shapely.from_wkb(raw)
        if not geometry.intersects(bounds):
            continue
        clipped = shapely.make_valid(geometry).intersection(bounds)
        if tolerance:
            clipped = clipped.simplify(tolerance)
        if not clipped.is_empty:
            yield shapely.transform(clipped, to_lonlat.transform, interleaved=False), values


def polygons(geometry):
    if geometry.geom_type == "Polygon":
        yield geometry
    elif geometry.geom_type in ("MultiPolygon", "GeometryCollection"):
        for part in geometry.geoms:
            yield from polygons(part)


def rings(polygon):
    return [np.round(np.asarray(ring.coords), 6).tolist()
            for ring in (polygon.exterior, *polygon.interiors)]


def prepare(database, region):
    root = PUBLIC / region
    terrain = json.loads((root / "metadata.json").read_text())
    detail = [terrain["longitudeWest"], terrain["latitudeSouth"], terrain["longitudeEast"], terrain["latitudeNorth"]]
    extent = json.loads((root / "crater.json").read_text())["bounds"] if region == "jezero" else detail
    units = {}
    for geometry, values in read_layer(database, "GeoUnits_v1", ["unit", "name", "symbol"], extent, 20):
        # IDs use source unit + 1 so zero always means outside mapped coverage.
        unit_id, name, symbol = values
        unit_id = int(unit_id)
        label, material, description = UNITS[unit_id]
        entry = units.setdefault(unit_id, {
            "id": unit_id + 1, "name": name.replace("Crater riim", "Crater rim"), "symbol": symbol,
            "label": label, "material": material, "description": description,
            "polygons": [], "color": COLORS[unit_id],
        })
        entry["polygons"].extend(rings(polygon) for polygon in polygons(geometry.intersection(box(*extent))))

    shape = (terrain["rows"] - 1, terrain["columns"] - 1)
    transform = from_bounds(*detail, shape[1], shape[0])
    precise_units = list(read_layer(database, "GeoUnits_v1", ["unit", "name", "symbol"], detail, 0))
    features = [(geometry, int(values[0]) + 1) for geometry, values in precise_units]
    # Centre sampling matches cellAt()/cellPoint(), with north in raster row zero.
    ids = rasterize(features, out_shape=shape, transform=transform, dtype="uint8") if features else np.zeros(shape, dtype=np.uint8)
    ids.tofile(root / "geology-grid.bin")
    flags = np.zeros(shape, dtype=np.uint8)
    sands = [geometry for geometry, values in precise_units if int(values[0]) == 7]
    mantles = [geometry for geometry, (kind,) in read_layer(database, "SurfaceFeatures", ["TYPE"], detail, 0)
               if kind == "dark-colored mantling material"]
    for value, shapes in ((1, sands), (2, mantles)):
        if shapes:
            flags |= rasterize([(feature, value) for feature in shapes], out_shape=shape,
                               transform=transform, all_touched=True, dtype="uint8")
    flags.tofile(root / "surface-flags.bin")
    for unit_id, unit in units.items():
        unit["cellCount"] = int(np.count_nonzero(ids == unit_id + 1))
        local = [polygon for geometry, values in precise_units if int(values[0]) == unit_id
                 for polygon in polygons(geometry.intersection(box(*detail)))]
        if local:
            label = max(local, key=lambda polygon: polygon.area).representative_point()
            unit["labelPoint"] = [round(label.x, 6), round(label.y, 6)]
    data = {
        "source": SOURCE, "title": "Geologic map of Jezero crater and the Nili Planum region, Mars",
        "authors": "Sun and Stack (2020)", "scale": 75000,
        "mapUrl": "https://mars.nasa.gov/maps/?mission=M20",
        "encoding": "Uint8 source unit + 1; zero unmapped; one value per mesh cell; row zero north",
        "coverageCellCount": int(np.count_nonzero(ids)), "cellCount": int(ids.size),
        "bounds": detail,
        "modelNote": "Geologic boundaries are published interpretations. Speed, grip, slip and wheel sinking are illustrative simulation assumptions, not measurements from the map.",
        "units": [unit for _, unit in sorted(units.items()) if unit["polygons"]],
    }
    (root / "geology.json").write_text(json.dumps(data, separators=(",", ":")) + "\n")
    print(region, "mapped cells", data["coverageCellCount"], "of", data["cellCount"],
          "local units", sum(unit["cellCount"] > 0 for unit in units.values()))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("geodatabase", type=Path, help="Path to Nili.gdb from the SIM 3464 data release")
    parser.add_argument("--region", choices=("jezero", "terrain", "all"), default="all")
    args = parser.parse_args()
    for region in ("jezero", "terrain") if args.region == "all" else (args.region,):
        prepare(args.geodatabase, region)
