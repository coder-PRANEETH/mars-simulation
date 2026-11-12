import { useMemo } from 'react'
import GroundResponse from '../ui/GroundResponse.jsx'
import { SURFACE_MODELS } from '../terrain/materials.js'

export function GeologyLayer({ data, locate, clipPath, selectedId, labels = false }) {
  const paths = useMemo(() => data.units.map((unit) => ({
    ...unit,
    path: unit.polygons.map((polygon) => polygon.map((ring) =>
      ring.map(([longitude, latitude], index) => {
        const { x, y } = locate(longitude, latitude)
        return `${index ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`
      }).join('') + 'Z',
    ).join('')).join(''),
    anchor: unit.labelPoint ? locate(...unit.labelPoint) : null,
  })), [data, locate])

  return <g aria-label="USGS geologic units" role="img" clipPath={clipPath} className="expedition-geology">
    {paths.map((unit) => <path key={unit.id} d={unit.path} fill={unit.color}
      stroke={selectedId === unit.id ? '#fff2d8' : unit.color}
      vectorEffect="non-scaling-stroke" strokeWidth={selectedId === unit.id ? 2.2 : 1}
      fillRule="evenodd" fillOpacity={selectedId && selectedId !== unit.id ? 0.1 : 0.35} />)}
    {labels && paths.filter((unit) => unit.anchor && (!selectedId || selectedId === unit.id)).map((unit) =>
      <text key={unit.id} x={unit.anchor.x} y={unit.anchor.y} className="expedition-unit-label"
        fontSize="72" textAnchor="middle" fill={unit.color} stroke="#071118" strokeWidth="10" paintOrder="stroke">
        {unit.symbol}
      </text>,
    )}
  </g>
}

export function GeologyExplorer({ data, selectedId, onSelect, context = false }) {
  if (!data) return <p role="status">Regional geology is unavailable. Elevation and slope still work.</p>
  const units = data.units.filter((unit) => context || unit.cellCount > 0)
  const selected = units.find((unit) => unit.id === selectedId)
  return <section className="expedition-region-explorer" aria-label="Geologic region explorer">
    <h2 className="expedition-section-label">Published geologic units</h2>
    <label className="expedition-region-select">Explore a geologic region
      <select value={selected?.id ?? ''} onChange={(event) => onSelect(Number(event.target.value) || null)}>
        <option value="">All regions</option>
        {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.symbol} · {unit.label}</option>)}
      </select>
    </label>
    <ul className="expedition-region-key" aria-label="Region colors">
      {units.map((unit) => <li key={unit.id}><button type="button" aria-pressed={selectedId === unit.id}
        onClick={() => onSelect(selectedId === unit.id ? null : unit.id)} aria-label={`Explore ${unit.label}`}>
        <i style={{ background: unit.color }} />{unit.symbol}<span>{unit.label}</span>
      </button></li>)}
    </ul>
    {selected ? <div className="expedition-region-description" aria-label="Selected geologic region">
      <h3 style={{ color: selected.color }}>{selected.label}</h3>
      <p>{selected.description}</p><small>{selected.symbol} · {selected.name}</small>
      <GroundResponse surface={SURFACE_MODELS[selected.material]} />
    </div> : <p>Colors mark different rock and sediment regions. Select one, or use Inspect and click the map.</p>}
    <p className="expedition-region-source">{data.authors} · 1:{data.scale.toLocaleString('en-US')} scale. Boundaries are regional interpretations.</p>
    <a href={data.source} target="_blank" rel="noreferrer">Read the USGS geologic map ↗</a>
  </section>
}
