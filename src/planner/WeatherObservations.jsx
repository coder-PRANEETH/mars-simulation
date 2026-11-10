import { useState } from 'react'

export default function WeatherObservations({ assetBase }) {
  const [data, setData] = useState(null)
  const [sol, setSol] = useState(null)
  const [error, setError] = useState(false)
  const selected = data?.observations.find((row) => row.sol === sol)

  function open(event) {
    if (!event.currentTarget.open || data) return
    setError(false)
    fetch(`${assetBase}/meda.json`)
      .then((response) => {
        if (!response.ok) throw new Error('Weather observations unavailable')
        return response.json()
      })
      .then((report) => {
        setData(report)
        setSol(report.observations.at(-1).sol)
      })
      .catch(() => setError(true))
  }

  return <details className="expedition-weather" onToggle={open}>
    <summary>Perseverance weather observations</summary>
    <p>Archived MEDA readings for selected sols. Route scenarios use the conditions you select in the planner.</p>
    {selected ? <>
      <select aria-label="Weather observation sol" value={sol} onChange={(event) => setSol(Number(event.target.value))}>
        {data.observations.map((row) => <option key={row.sol} value={row.sol}>Sol {row.sol} · {row.date}</option>)}
      </select>
      <dl className="expedition-readings">
        <dt>Air temperature</dt><dd>{selected.lowC} to {selected.highC} °C</dd>
        <dt>Pressure</dt><dd>{selected.pressurePa} Pa</dd>
        <dt>Local sunrise / sunset</dt><dd>{selected.sunrise.slice(0, 5)} / {selected.sunset.slice(0, 5)}</dd>
      </dl>
      <a href={data.source} target="_blank" rel="noreferrer">NASA / JPL / CAB weather data ↗</a>
    </> : <p role="status">{error ? 'Observations unavailable. Reopen this panel to retry.' : 'Loading archived observations…'}</p>}
  </details>
}
