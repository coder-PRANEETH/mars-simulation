import { useEffect, useRef, useState } from 'react'
import Icon from '../ui/Icon.jsx'

export default function MapLayersMenu({ openMap, context, layer, onLayer, overlays }) {
  const [open, setOpen] = useState(false)
  const root = useRef(null)
  const trigger = useRef(null)
  useEffect(() => {
    if (!openMap) setOpen(false)
  }, [openMap])
  useEffect(() => {
    if (!open) return
    const outside = (event) => { if (!root.current?.contains(event.target)) setOpen(false) }
    const escape = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus() }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [open])
  const count = overlays.filter((overlay) => overlay.active && !overlay.disabled).length
  return <div className="mission-layers" ref={root}>
    <button type="button" ref={trigger} className="mission-layers-trigger" aria-label="Map layers" aria-expanded={open} aria-controls="mission-layer-options" onClick={() => setOpen(!open)}>
      <Icon name="layers" size={17} />Layers<span aria-hidden="true">{count || ''}</span>
    </button>
    {open && <section id="mission-layer-options" className="mission-layer-options" aria-label="Map layers">
      {!context ? <label>Base map<select aria-label="Base map" value={layer} onChange={(event) => onLayer(event.target.value)}>
        {['Imagery', 'Elevation', 'Slope'].map((name) => <option key={name}>{name}</option>)}
      </select></label> : <p>CTX elevation · crater overview</p>}
      <div role="group" aria-label="Map overlays">{overlays.map(({ name, active, onChange, disabled }) =>
        <label key={name}><input type="checkbox" checked={active} onChange={onChange} disabled={disabled} />{name}</label>
      )}</div>
      <p>Layers stay visible when you change workspaces.</p>
    </section>}
  </div>
}
