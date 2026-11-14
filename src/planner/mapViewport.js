const clamp = (value, max) => Math.max(0, Math.min(max, value))

export function boundView(view, width, height) {
  return { ...view, x: clamp(view.x, width - view.width), y: clamp(view.y, height - view.height) }
}

// Keep the same map coordinate under the cursor when the scale changes.
export function zoomView(view, anchor, factor, width, height) {
  const nextWidth = Math.max(width / 12, Math.min(width, view.width * factor))
  const ratio = nextWidth / view.width
  return boundView({ x: anchor.x - (anchor.x - view.x) * ratio,
    y: anchor.y - (anchor.y - view.y) * ratio,
    width: nextWidth, height: height * nextWidth / width }, width, height)
}
