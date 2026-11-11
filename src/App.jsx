import { Component, Suspense, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three';
import { loadTerrain } from './terrain/terrain.js';
import { createEnvironment } from './simulation/environment.js';
import { simulationStore, useSimulation } from './simulation/store.js';
import World from './scene/World.jsx';
import Hud from './ui/Hud.jsx';
import ExpeditionMap from './planner/ExpeditionMap.jsx';
import DrivingHazards from './planner/DrivingHazards.jsx';

class SceneErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) return <div className="webgl-error"><h2>Simulation could not start</h2><p>{this.state.error.message}</p><p>Use a browser with WebGL 2 enabled, then reload the page.</p></div>;
    return this.props.children;
  }
}

export default function App() {
  const simulation = useSimulation();
  const [mapOpen, setMapOpen] = useState(false);
  const [driving, setDriving] = useState(false);
  const [carActive, setCarActive] = useState(false);
  const [showHazards, setShowHazards] = useState(true);
  const [activeRoute, setActiveRoute] = useState(null);
  const [waypointIndex, setWaypointIndex] = useState(0);
  const [region, setRegion] = useState('terrain');
  const [terrain, setTerrain] = useState(null);
  const [environment, setEnvironment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [locked, setLocked] = useState(false);
  const [debug, setDebug] = useState(false);
  const [telemetry, setTelemetry] = useState({});
  const [inspection, setInspection] = useState(null);
  const playerRef = useRef(null);
  const sceneRef = useRef(null);
  const latestTelemetry = useRef(telemetry);
  latestTelemetry.current = telemetry;

  useEffect(() => {
    let cancelled = false;
    loadTerrain(region).then((data) => {
      if (cancelled) return;
      setTerrain(data);
      setEnvironment(createEnvironment(data));
    }).catch((error) => { if (!cancelled) { setLoadError(error.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, [region]);

  useEffect(() => {
    simulationStore.refreshWeather();
    const timer = window.setInterval(simulationStore.refreshWeather, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const keyDown = (event) => {
      if (event.code === 'F3') { event.preventDefault(); setDebug((current) => !current); }
    };
    window.addEventListener('keydown', keyDown);
    return () => window.removeEventListener('keydown', keyDown);
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    // Browser acceptance checks use the same simulation state as the scene.
    window.__MARS_SIM__ = {
      getTelemetry: () => latestTelemetry.current,
      getSimulation: simulationStore.getState,
      setParameter: simulationStore.setParameter,
      applyPreset: simulationStore.applyPreset,
      getTerrain: () => terrain,
      getRenderDiagnostics: () => {
        const rendering = sceneRef.current;
        const dust = rendering?.scene.getObjectByName('mars-dust');
        return {
          fogDensity: rendering?.scene.fog?.density,
          dustParticleCount: dust?.visible ? dust.geometry.drawRange.count : 0,
          cameraPosition: rendering?.camera.position.toArray(),
          cameraFov: rendering?.camera.fov,
        };
      },
      reset: () => playerRef.current?.reset(),
    };
    return () => { delete window.__MARS_SIM__; };
  }, [terrain]);

  const nextWaypoint = activeRoute?.waypoints[waypointIndex];
  const position = telemetry.position;
  const guide = nextWaypoint && position ? {
    waypoint: nextWaypoint,
    number: waypointIndex + 1,
    count: activeRoute.waypoints.length,
    distance: Math.hypot(nextWaypoint.x - position.x, nextWaypoint.z - position.z),
    bearing: (Math.atan2(nextWaypoint.x - position.x, position.z - nextWaypoint.z) * 180 / Math.PI + 360) % 360,
  } : null;
  const reached = (locked || (carActive && !mapOpen)) && guide && guide.distance <= 14;
  useEffect(() => {
    if (reached) setWaypointIndex((index) => index + 1);
  }, [reached, waypointIndex]);

  const launchRoute = (route, asCar) => {
    const [start, next] = route.points;
    const yaw = -Math.atan2(next.x - start.x, start.z - next.z);
    playerRef.current?.reset({ ...start, yaw });
    setInspection(null);
    setWaypointIndex(1);
    setActiveRoute(route);
    setDriving(asCar);
    setCarActive(asCar);
    setMapOpen(false);
  };

  const changeRegion = () => {
    setActiveRoute(null);
    setCarActive(false);
    setTerrain(null);
    setEnvironment(null);
    setInspection(null);
    setTelemetry({});
    setLoadError(null);
    setLoading(true);
    setMapOpen(region === 'terrain');
    setRegion(region === 'terrain' ? 'jezero' : 'terrain');
  };
  const drivingHazards = carActive && !mapOpen && showHazards && terrain
    ? { telemetry, route: activeRoute } : null;
  const enter = () => driving ? setCarActive(true) : playerRef.current?.enter();
  const toggleDriving = () => {
    setCarActive(false);
    setDriving((mode) => !mode);
  };
  const reset = () => { playerRef.current?.reset(); setInspection(null); setActiveRoute(null); };

  return <main className="simulation-viewport">
    <SceneErrorBoundary key={region}>
      <Canvas
        frameloop={mapOpen && !loading ? 'never' : 'always'}
        shadows="soft"
        dpr={[1, 1.5]}
        camera={{ fov: 72, near: 0.07, far: 7000, position: [0, 70, 0] }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={(rendering) => { sceneRef.current = rendering; const { gl } = rendering; gl.toneMapping = ACESFilmicToneMapping; gl.toneMappingExposure = 1.05; gl.outputColorSpace = SRGBColorSpace; }}
        fallback={<div className="webgl-error"><h2>WebGL is unavailable</h2><p>Enable hardware acceleration in your browser to walk on Mars.</p></div>}
      >
        <Suspense fallback={null}>
          {terrain && environment && <World driving={driving} carActive={carActive && !mapOpen} onPauseCar={() => setCarActive(false)} route={activeRoute} terrain={terrain} environment={environment} playerRef={playerRef} onTelemetry={setTelemetry} onLockChange={setLocked} onInspect={setInspection} inspection={inspection} onReady={() => setLoading(false)} />}
        </Suspense>
      </Canvas>
    </SceneErrorBoundary>
    <div inert={mapOpen && !loading && !loadError}>
    <Hud driving={driving} carActive={carActive} showHazards={showHazards} onToggleHazards={() => setShowHazards((visible) => !visible)} onToggleDriving={toggleDriving} onOpenMap={region === 'jezero' && !loading && !loadError ? () => setMapOpen(true) : null} region={region} onChangeRegion={changeRegion} simulation={simulation} telemetry={telemetry} metadata={terrain?.metadata} locked={locked} loading={loading} loadError={loadError} onEnter={enter} onReset={reset} debug={debug} inspection={inspection} onClearInspection={() => setInspection(null)} />
    </div>
    {activeRoute && !mapOpen && <aside className="expedition-guide" aria-label="Traverse guidance">
      <strong>{guide ? `Next stop ${guide.number} of ${guide.count} · ${guide.waypoint.label === 'Traverse' ? 'Follow your route' : guide.waypoint.label}` : 'You reached your destination!'}</strong>
      {guide && <span>{Math.round(guide.distance)} m to go · direction {Math.round(guide.bearing) % 360}°</span>}
    </aside>}
    {region === 'terrain' && drivingHazards && <DrivingHazards terrain={terrain} {...drivingHazards} />}
    {region === 'jezero' && !loading && !loadError && terrain &&
      <ExpeditionMap terrain={terrain} drivingHazards={drivingHazards} open={mapOpen} onClose={() => setMapOpen(false)} onLaunch={launchRoute} onClearRoute={() => setActiveRoute(null)} />}
  </main>;
}
