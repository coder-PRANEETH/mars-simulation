const paths = {
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  back: 'M20 12H4m6-6-6 6 6 6',
  compass: 'm16 8-3 5-5 3 3-5 5-3M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  layers: 'm12 3 9 5-9 5-9-5 9-5m-9 9 9 5 9-5m-18 5 9 5 9-5',
  info: 'M12 11v6m0-10h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  close: 'm6 6 12 12M18 6 6 18',
  wind: 'M3 8h12a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h5a2 2 0 1 1-2 2',
  temperature: 'M14 14.5V5a2 2 0 0 0-4 0v9.5a4 4 0 1 0 4 0M12 9v8',
  pin: 'M18 10c0 5-6 11-6 11S6 15 6 10a6 6 0 1 1 12 0Zm-4 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0',
  route: 'M6 5h10a4 4 0 0 1 0 8H8a4 4 0 0 0 0 8h10M6 2v6m12 10v6',
  hazard: 'm12 3 10 18H2L12 3Zm0 6v5m0 3h.01',
  walking: 'm14 4 .01 0M9 20l2-6-3-3 4-4 3 4 4 1M11 14l5 6M8 11l-3 1',
  car: 'm4 10 2-5h12l2 5M3 10h18v8H3v-8Zm2 8v3m14-3v3M6 13h2m8 0h2',
}

export default function Icon({ name, size = 20, ...props }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d={paths[name] ?? paths.arrow} />
  </svg>
}
