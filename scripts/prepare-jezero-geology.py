"""Clip USGS SIM 3464 units and rasterize mapped surface cautions for Jezero."""
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

ROOT = Path(__file__).resolve().parents[1] / "public" / "jezero"
SOURCE = "https://pubs.usgs.gov/publication/sim3464"
COLORS = (
    "#62a895", "#d4a76e", "#c88a60", "#a084c1", "#668fc1", "#b6bd72", "#bf7569",
    "#d3a849", "#92849c", "#a6bbbf", "#779688", "#8e7a76", "#a89174", "#c296a1",
)


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
        clipped = shapely.make_valid(geometry).intersection(bounds).simplify(tolerance)
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


def prepare(database):
    terrain = json.loads((ROOT / "metadata.json").read_text())
    extent = json.loads((ROOT / "crater.json").read_text())["bounds"]
    detail = [terrain["longitudeWest"], terrain["latitudeSouth"], terrain["longitudeEast"], terrain["latitudeNorth"]]
    units = {}
    caution = []
    for geometry, values in read_layer(database, "GeoUnits_v1", ["unit", "name", "symbol_noSub"], extent, 20):
        # pyogrio preserves source field order. The source unit ID determines the display color.
        unit_id, name, symbol = values
        name = name.replace("Crater riim", "Crater rim")
        entry = units.setdefault(int(unit_id), {"name": name, "symbol": symbol, "polygons": []})
        for polygon in polygons(geometry.intersection(box(*extent))):
            entry["polygons"].append(rings(polygon))
            if name == "Eolian bedform unit" and polygon.intersects(box(*detail)):
                caution.append(polygon)

    surfaces = [
        polygon for geometry, (kind,) in read_layer(database, "SurfaceFeatures", ["TYPE"], detail, 10)
        for polygon in polygons(geometry.intersection(box(*detail)))
        if kind == "dark-colored mantling material"
    ]
    shape = (terrain["rows"] - 1, terrain["columns"] - 1)
    transform = from_bounds(*detail, shape[1], shape[0])
    flags = np.zeros(shape, dtype=np.uint8)
    for value, features in ((1, caution), (2, surfaces)):
        if features:
            flags |= rasterize([(feature, value) for feature in features], out_shape=shape,
                               transform=transform, all_touched=True, dtype="uint8")
    flags.tofile(ROOT / "surface-flags.bin")
    data = {
        "source": SOURCE,
        "units": [{**unit, "color": COLORS[id]} for id, unit in sorted(units.items()) if unit["polygons"]],
    }
    (ROOT / "geology.json").write_text(json.dumps(data, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("geodatabase", type=Path, help="Path to Nili.gdb from the SIM 3464 data release")
    prepare(parser.parse_args().geodatabase)
