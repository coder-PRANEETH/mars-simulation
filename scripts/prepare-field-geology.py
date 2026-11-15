"""Register Stack et al. (2020) bedrock and surficial polygons without conflating maps."""
import argparse,json
from pathlib import Path
import numpy as np
from pyogrio.raw import read
from pyproj import CRS,Transformer
import shapely
from shapely.geometry import box
from rasterio.features import rasterize
from rasterio.transform import from_bounds

CATALOG=Path(__file__).resolve().parents[1]/'src/terrain/data/jezeroFieldUnits.json'

def rings(poly):
    return [np.round(np.asarray(r.coords),6).tolist() for r in (poly.exterior,*poly.interiors)]

def polygons(g):
    if g.geom_type=='Polygon': yield g
    elif g.geom_type in ('MultiPolygon','GeometryCollection'):
        for p in g.geoms: yield from polygons(p)

def prepare(shape,root):
    catalog=json.loads(CATALOG.read_text());meta=json.loads((root/'metadata.json').read_text())
    extent=[meta['longitudeWest'],meta['latitudeSouth'],meta['longitudeEast'],meta['latitudeNorth']]
    source,_,geometries,attributes=read(shape,columns=['BedrkUName','SurfUName'])
    crs=CRS.from_wkt(source['crs']);project=Transformer.from_crs(crs.geodetic_crs,crs,always_xy=True);geographic=Transformer.from_crs(crs,crs.geodetic_crs,always_xy=True)
    clip=box(*project.transform_bounds(*extent))
    unit_by_name={u['name']:u for u in catalog['units']};cover_by_name={c['name']:c for c in catalog['covers']}
    units={u['id']:{**u,'polygons':[]} for u in catalog['units']}
    unit_features=[];cover_features=[];bounds_geo=box(*extent)
    fields=list(source['fields'])
    for raw,name,cover in zip(geometries,attributes[fields.index('BedrkUName')],attributes[fields.index('SurfUName')]):
        if raw is None: continue
        g=shapely.from_wkb(raw)
        if not g.intersects(clip): continue
        g=shapely.make_valid(g).intersection(clip)
        if g.is_empty: continue
        lonlat=shapely.transform(g,geographic.transform,interleaved=False).intersection(bounds_geo)
        if name in unit_by_name:
            unit=unit_by_name[name];unit_features.append((lonlat,unit['id']))
            simple=shapely.transform(g.simplify(5,preserve_topology=True),geographic.transform,interleaved=False).intersection(bounds_geo)
            units[unit['id']]['polygons'].extend(rings(p) for p in polygons(simple))
        if cover in cover_by_name: cover_features.append((lonlat,cover_by_name[cover]['id']))
    dims=(meta['rows']-1,meta['columns']-1);transform=from_bounds(*extent,dims[1],dims[0])
    ids=rasterize(unit_features,out_shape=dims,transform=transform,dtype='uint8') if unit_features else np.zeros(dims,dtype='uint8')
    covers=rasterize(cover_features,out_shape=dims,transform=transform,dtype='uint8') if cover_features else np.zeros(dims,dtype='uint8')
    if not ids.any(): raise ValueError('No field geology registered; check source fields and coordinate frame.')
    ids.tofile(root/'photogeology-grid.bin');covers.tofile(root/'cover-grid.bin')
    for uid,u in units.items():
        u['cellCount']=int(np.count_nonzero(ids==uid))
        local=[g for g,i in unit_features if i==uid]
        if local:
            anchor=max(local,key=lambda p:p.area).representative_point();u['labelPoint']=[round(anchor.x,6),round(anchor.y,6)]
    data={'source':catalog['source'],'title':'Mars 2020 Science Team photogeologic field map','authors':catalog['authors'],'scale':5000,
      'epochNote':catalog['epochNote'],'bounds':extent,'encoding':'Registered bedrock IDs 1–15; zero outside published coverage. Separate surficial-cover IDs.',
      'coverageCellCount':int(np.count_nonzero(ids)),'cellCount':int(ids.size),'covers':catalog['covers'],
      'modelNote':'Published pre-landing interpretations. Boundaries simplified by up to 5 m for display; classification uses unsimplified source polygons. Mobility parameters are illustrative, not measured rock strength.',
      'license':'CC BY 4.0, per the publisher’s current Open Access article licence; clipped, simplified and annotated here.',
      'units':[u for u in units.values() if u['polygons']]}
    (root/'photogeology.json').write_text(json.dumps(data,separators=(',',':'))+'\n')
    print(root.name,'field units',len(data['units']),'bedrock coverage',round(np.count_nonzero(ids)/ids.size*100,1),'%',flush=True)

if __name__=='__main__':
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('shapefile',type=Path);ap.add_argument('--public-root',type=Path,required=True);ap.add_argument('--regions',nargs='+',default=['jezero','jezero-regional']);a=ap.parse_args()
    for region in a.regions: prepare(a.shapefile,a.public_root/region)
