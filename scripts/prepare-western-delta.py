"""Build a wider Jezero terrain from official CTX products; no synthetic heights."""
import argparse
import importlib.util
import json
import shutil
from pathlib import Path
import numpy as np
from PIL import Image
import rasterio
from pyproj import CRS, Transformer
from rasterio.windows import from_bounds

RADIUS = 3396190
BOUNDS = (77.22, 18.31, 77.57, 18.63)
DEM_URL = 'https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX/ScienceInvestigationMaps_JPL/M20_JezeroCrater_CTXDEM_20m.tif'
IMAGE_URL = 'https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX/JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0.tif'

def transform(raster, inverse=False):
    crs = CRS.from_wkt(raster.crs.to_wkt())
    return Transformer.from_crs(*( (crs, crs.geodetic_crs) if inverse else (crs.geodetic_crs, crs)), always_xy=True)

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--dem', type=Path, required=True)
    ap.add_argument('--image', type=Path, required=True)
    ap.add_argument('--usgs-gdb', type=Path, required=True)
    ap.add_argument('--output', type=Path, required=True, help='Public asset root; writes jezero-regional/')
    args = ap.parse_args()
    root = args.output / 'jezero-regional'; root.mkdir(parents=True, exist_ok=True)
    with rasterio.open(args.dem) as r:
        to_map = transform(r); to_geo = transform(r, True)
        west, south = to_map.transform(*BOUNDS[:2]); east, north = to_map.transform(*BOUNDS[2:])
        first_row, first_col = r.index(west, north); last_row, last_col = r.index(east, south)
        rows = np.arange(first_row, last_row + 1, 2); cols = np.arange(first_col, last_col + 1, 2)
        window = rasterio.windows.Window(cols[0], rows[0], cols[-1] - cols[0] + 1, rows[-1] - rows[0] + 1)
        raw = r.read(1, window=window, masked=True)[::2, ::2]
        if raw.mask.any() or not np.isfinite(raw).all(): raise ValueError('Regional crop contains missing elevation; do not fill it synthetically.')
        values = raw.filled(np.nan).astype(np.float32)
        w,n = to_geo.transform(*r.xy(rows[0], cols[0])); e,s = to_geo.transform(*r.xy(rows[-1], cols[-1]))
    lat=(n+s)/2; lon=(w+e)/2
    width=np.radians(e-w)*RADIUS*np.cos(np.radians(lat)); depth=np.radians(n-s)*RADIUS
    offset=float(np.median(values)); (values-offset).astype('<f4').tofile(root/'heights.bin')
    fine_root=Path(__file__).resolve().parents[1]/'public'/'jezero'
    fine=json.loads((fine_root/'metadata.json').read_text())
    with rasterio.open(args.image) as r:
        project=transform(r); a,b=project.transform(w,s);c,d=project.transform(e,n)
        window=from_bounds(a,b,c,d,r.transform)
        for size,name in [(1024,'overview.jpg'),(3072,'texture.jpg')]:
            image=r.read(1,window=window,out_shape=(size,size),masked=True)
            if image.mask.any(): raise ValueError('Regional optical image contains gaps.')
            low,high=np.percentile(image,(1,99)); image=np.clip((image-low)*255/(high-low),0,255).astype(np.uint8)
            Image.fromarray(image).save(root/name,quality=86,optimize=True)
    for name in ['crater.json','crater.jpg','thermal.png','meda.json']:
        if (fine_root/name).exists(): shutil.copyfile(fine_root/name,root/name)
    # The known landing site gives a useful start view in the wider scene.
    sx=(77.45088572-lon)/(e-w)*width; sz=(18.44462715-lat)/(s-n)*depth
    meta={
      'name':'Western Delta and surroundings','region':'Jezero Crater / Western Delta regional terrain',
      'datasetName':'Mars 2020 CTX regional terrain and optical image mosaics',
      'credit':'NASA / JPL-Caltech / MSSS / USGS Astrogeology',
      'columns':int(values.shape[1]),'rows':int(values.shape[0]),'widthMeters':width,'depthMeters':depth,'areaKm2':width*depth/1e6,
      'elevationOffset':offset,'minimumElevation':float(values.min()),'maximumElevation':float(values.max()),
      'elevationDatum':'USGS CTX product, MOLA topography / DeltaGeoid','centerLatitude':lat,'centerLongitude':lon,
      'latitudeNorth':n,'latitudeSouth':s,'longitudeWest':w,'longitudeEast':e,
      'originalResolutionMeters':20,'originalImageryResolutionMeters':6,'meshResolutionMeters':40,'textureSize':3072,
      'analysisQuality':0.65,'coverageTier':'CTX regional','spawn':{'x':sx,'z':sz,'yaw':1.15},
      'surfaceInformation':'Measured CTX terrain sampled at 40 m. Small obstacles, ripples and scarps are unresolved.',
      'detailInset':{'assetDirectory':'jezero','bounds':[fine['longitudeWest'],fine['latitudeSouth'],fine['longitudeEast'],fine['latitudeNorth']],
        'gridMeters':8,'sourceDemMeters':1,'sourceImageMeters':0.25},
      'sources':[{'name':'CTX 20 m elevation mosaic','url':DEM_URL},{'name':'CTX 6 m orthomosaic','url':IMAGE_URL}],
      'transformations':['Retained every second CTX elevation post; no height fabrication or vertical exaggeration.',
        'Converted source projected coordinates to planetocentric latitude/east-positive longitude and local ground metres.',
        'Contrast-stretched the optical mosaic into 1024/3072 pixel display images; detailed HiRISE inset is separate.']}
    (root/'metadata.json').write_text(json.dumps(meta,indent=2)+'\n')
    spec=importlib.util.spec_from_file_location('geology',Path(__file__).with_name('prepare-jezero-geology.py'))
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);module.PUBLIC=args.output
    module.prepare(args.usgs_gdb,'jezero-regional')
    print('Regional terrain',values.shape,round(meta['areaKm2'],2),'km²; all sampled elevations valid.')

if __name__=='__main__': main()
