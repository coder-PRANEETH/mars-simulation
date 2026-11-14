import { useEffect, useRef, useState } from 'react'
import { boundView, zoomView } from './mapViewport.js'

export default function MapViewport({ width, height, children, onClick, ...props }) {
  const full = { x: 0, y: 0, width, height }
  const [view, setView] = useState(full)
  const svg = useRef(null)
  const current = useRef(view)
  current.current = view
  const drag = useRef(null)
  const dragged = useRef(false)
  const pointAt = (event) => new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.current.getScreenCTM().inverse())

  useEffect(() => {
    const element = svg.current
    const wheel = (event) => {
      event.preventDefault()
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 600 : 1)
      setView(zoomView(current.current, pointAt(event), Math.exp(Math.max(-300, Math.min(300, delta)) * .002), width, height))
    }
    element.addEventListener('wheel', wheel, { passive: false })
    return () => element.removeEventListener('wheel', wheel)
  }, [width, height])

  const zoom = (factor) => setView(zoomView(view, { x: view.x + view.width / 2, y: view.y + view.height / 2 }, factor, width, height))
  return <div className="expedition-viewport">
    <svg ref={svg} viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`} {...props}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        dragged.current = false
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, point: pointAt(event), view }
      }}
      onPointerMove={(event) => {
        const start = drag.current
        if (!start || start.id !== event.pointerId || view.width === width) return
        if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < 5 && !dragged.current) return
        dragged.current = true
        svg.current.setPointerCapture(event.pointerId)
        const point = pointAt(event)
        setView(boundView({ ...view, x: view.x + start.point.x - point.x, y: view.y + start.point.y - point.y }, width, height))
      }}
      onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}
      onClickCapture={(event) => { if (dragged.current) { event.stopPropagation(); dragged.current = false } }} onClick={onClick}>
      {children}
    </svg>
    <div className="expedition-zoom" role="group" aria-label="Map zoom">
      <button type="button" aria-label="Zoom in" disabled={view.width <= width / 12 + .01} onClick={() => zoom(.7)}>+</button>
      <button type="button" aria-label="Zoom out" disabled={view.width >= width} onClick={() => zoom(1 / .7)}>−</button>
      <button type="button" aria-label="Reset map zoom" onClick={() => setView(full)}>{(width / view.width).toFixed(1)}×</button>
    </div>
    <span className="expedition-zoom-hint">Scroll to zoom · drag to pan</span>
  </div>
}
