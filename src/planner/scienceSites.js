// Coordinates are representative points in the planetocentric, east-positive frame.
// Rover positions use NASA MMGIS end-of-drive localization for the listed sols.
export const scienceSites = [
  {
    id: 'delta', name: 'Western Delta front', latitude: 18.45056632, longitude: 77.40142219,
    category: 'Sedimentary geology', habitability: 5, geology: 4,
    description: 'Compare exposed sedimentary layers near the fan front. Finer deposits are candidates for investigating past habitability and preservation of biosignatures.',
    locationNote: 'Perseverance observation area, sol 422.',
    source: 'https://www.jpl.nasa.gov/news/nasas-perseverance-rover-arrives-at-delta-for-new-science-campaign/',
  },
  {
    id: 'kodiak', name: 'Kodiak viewpoint', latitude: 18.4390, longitude: 77.4130,
    category: 'Delta stratigraphy', habitability: 4, geology: 4,
    description: 'Observe the layered delta remnant from the floor east of the butte. The bedding provides evidence of sediment accumulating in a standing body of water.',
    locationNote: 'Approximate proposed viewpoint digitized from the HiRISE mosaic.',
    source: 'https://www.jpl.nasa.gov/images/pia24814-jezero-craters-kodiak-and-scarps/',
  },
  {
    id: 'seitah', name: 'Séítah formation', latitude: 18.43266059, longitude: 77.44137302,
    category: 'Igneous crater floor', habitability: 3, geology: 5,
    description: 'Investigate the olivine-rich crater-floor rocks and how water later altered them. This is a contrasting setting to the sedimentary delta.',
    locationNote: 'Perseverance near Issole, sol 286.',
    source: 'https://doi.org/10.1029/2022JE007474',
  },
  {
    id: 'neretva', name: 'Neretva Vallis', latitude: 18.4952063, longitude: 77.30391283,
    category: 'Ancient inlet', habitability: 5, geology: 5,
    description: 'Study the sediments of the former inlet channel and their relationship to the delta. Compare textures and mineral alteration along the river valley.',
    locationNote: 'Perseverance observation area, sol 1175. Crater overview only.',
    source: 'https://science.nasa.gov/photojournal/perseverances-trip-to-broom-point/',
  },
  {
    id: 'depot', name: 'Three Forks area', latitude: 18.45272753, longitude: 77.40833585,
    category: 'Mission context', habitability: 2, geology: 2,
    description: 'Review the setting of the Perseverance sample depot near the fan front. The marker represents the depot area. Keep hypothetical sampling separate from the cached hardware.',
    locationNote: 'Perseverance in the depot area, sol 674.',
    source: 'https://science.nasa.gov/resource/perseverances-three-forks-sample-depot-map/',
  },
  {
    id: 'landing', name: 'Octavia E. Butler Landing Site', latitude: 18.44462715, longitude: 77.45088572,
    category: 'Mission context', habitability: 1, geology: 2,
    description: 'Use the historic landing site as a reference for the crater-floor traverse and compare the local terrain with Perseverance’s first observations.',
    locationNote: 'Perseverance landing position in the NASA traverse archive.',
    source: 'https://science.nasa.gov/mission/mars-2020-perseverance/location-map/',
  },
]
