/** Common model readout for a selected region, map point, scanner or rover. */
export default function GroundResponse({ surface, sinkDepth, wheelSlip }) {
  if (!surface) return null
  const grip = surface.gripFactor >= 0.9 ? 'High' : surface.gripFactor >= 0.75 ? 'Moderate' : 'Low'
  const maximum = Math.round((surface.sinkDepth ?? 0) * 100)
  return <div className="ground-response" aria-label="Simulated ground response">
    <h4>Simulated ground response</h4>
    <dl>
      <dt>Ground type</dt><dd>{surface.name}</dd>
      <dt>Base travel speed</dt><dd>{Math.round(surface.speedFactor * 100)}% of level, firm ground</dd>
      <dt>Grip</dt><dd>{grip}</dd>
      <dt>Wheel sinking</dt><dd>{sinkDepth == null
        ? maximum ? `Up to ${maximum} cm` : 'None modeled'
        : `${Math.round(sinkDepth * 100)} cm${maximum ? ` · up to ${maximum} cm` : ''}`}</dd>
      {wheelSlip != null && <><dt>Wheel slip</dt><dd>{Math.round(wheelSlip * 100)}%</dd></>}
    </dl>
    <p>These are simulation assumptions, not soil-strength measurements. Surface cover, slopes and roughness change the local response.</p>
  </div>
}

export function GroundInfo({ surface, sinkDepth, wheelSlip }) {
  if (!surface) return null
  return <>
    <div className="ground-region-name"><i style={{ background: surface.unit?.color ?? '#8e9b9f' }} />{surface.unit?.label ?? 'Geology not mapped here'}</div>
    {surface.unit ? <>
      <p className="ground-region-description">{surface.unit.description}</p>
      <p className="ground-region-unit">{surface.unit.symbol} · {surface.unit.name}</p>
    </> : <p className="ground-region-description">{surface.surfaceMapped
      ? 'Mapped surface cover is available here, but the underlying geologic unit is unavailable.'
      : 'This spot is outside the regional geologic map. The model uses measured slope and unevenness, without assuming loose soil or wheel sinking.'}</p>}
    <GroundResponse surface={surface} sinkDepth={sinkDepth} wheelSlip={wheelSlip} />
    {surface.unit && <a className="ground-source" href="https://pubs.usgs.gov/publication/sim3464" target="_blank" rel="noreferrer">Published USGS geology ↗</a>}
  </>
}
