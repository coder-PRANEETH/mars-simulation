import { planRoutes } from './route.js'

let grid
self.onmessage = ({ data }) => {
  if (data.grid) {
    grid = data.grid
    return
  }

  const { id, request } = data
  try {
    self.postMessage({ id, result: planRoutes(grid, request) })
  } catch (error) {
    self.postMessage({ id, error: error.message })
  }
}
