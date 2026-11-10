import { useEffect, useRef, useState } from 'react'

export function useRoutes(grid) {
  const worker = useRef(null)
  const requestId = useRef(0)
  const [planning, setPlanning] = useState(false)
  const [routes, setRoutes] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const planner = new Worker(new URL('./route.worker.js', import.meta.url), { type: 'module' })
    worker.current = planner
    planner.onmessage = ({ data }) => {
      if (data.id !== requestId.current) return
      setRoutes(data.result ?? null)
      setError(data.error ?? null)
      setPlanning(false)
    }
    planner.onerror = () => {
      setError('The route engine could not start. Reopen Jezero and try again.')
      setPlanning(false)
    }
    planner.postMessage({ grid })
    return () => { planner.terminate(); worker.current = null }
  }, [grid])

  function clear() {
    requestId.current++
    setRoutes(null)
    setError(null)
    setPlanning(false)
  }

  function calculate(request) {
    clear()
    setPlanning(true)
    worker.current.postMessage({ id: requestId.current, request })
  }

  return { planning, routes, error, clear, calculate }
}
