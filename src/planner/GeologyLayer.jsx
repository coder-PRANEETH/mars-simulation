import { useMemo } from 'react'

export function GeologyLayer({ data, locate, clipPath }) {
  const paths = useMemo(() => data.units.map((unit) => ({
    ...unit,
    path: unit.polygons.map((polygon) => polygon.map((ring) =>
      ring.map(([longitude, latitude], index) => {
        const { x, y } = locate(longitude, latitude)
        return `${index ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`
      }).join('') + 'Z',
    ).join('')).join(''),
  })), [data, locate])

  return <g aria-label="USGS geologic units" role="img" clipPath={clipPath} className="expedition-geology">
    {paths.map((unit) => <path key={unit.name} d={unit.path} fill={unit.color} stroke={unit.color}
      vectorEffect="non-scaling-stroke" strokeWidth="0.7" fillRule="evenodd" opacity="0.62" />)}
  </g>
}

export function GeologyLegend({ data, error }) {
  if (!data) return <p role="status">{error ? 'Geology could not be loaded. Toggle the layer to retry.' : 'Loading mapped geology…'}</p>
  return <details open className="expedition-geology-legend">
    <summary>Published geologic units</summary>
    <ul className="expedition-legend">
      {data.units.map(({ color, name, symbol }) => <li key={name}><i style={{ backgroundColor: color }} />{symbol} · {name}</li>)}
    </ul>
    <p>Regional interpretation at 1:75,000 scale.</p>
    <a href={data.source} target="_blank" rel="noreferrer">USGS geologic map ↗</a>
  </details>
}
