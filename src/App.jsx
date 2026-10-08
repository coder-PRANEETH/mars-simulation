import { Component, Suspense, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three';
import { loadTerrain } from './terrain/terrain.js';
import { createEnvironment } from './simulation/environment.js';
import { simulationStore, useSimulation } from './simulation/store.js';
import World from './scene/World.jsx';
import Hud from './ui/Hud.jsx';

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
    loadTerrain().then((data) => {
      if (cancelled) return;
      setTerrain(data);
      setEnvironment(createEnvironment(data));
    }).catch((error) => { if (!cancelled) { setLoadError(error.message); setLoading(false); } });
    return () => { cancelled = true; };
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
    // Read-only telemetry plus the same parameter API as the controls, for local
    // browser acceptance checks. There is no separate testing physics path.
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

  const enter = () => playerRef.current?.enter();
  const reset = () => { playerRef.current?.reset(); setInspection(null); };

  return <main className="simulation-viewport">
    <SceneErrorBoundary>
      <Canvas
        shadows="soft"
        dpr={[1, 1.5]}
        camera={{ fov: 72, near: 0.07, far: 7000, position: [0, 70, 0] }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={(rendering) => { sceneRef.current = rendering; const { gl } = rendering; gl.toneMapping = ACESFilmicToneMapping; gl.toneMappingExposure = 1.05; gl.outputColorSpace = SRGBColorSpace; }}
        fallback={<div className="webgl-error"><h2>WebGL is unavailable</h2><p>Enable hardware acceleration in your browser to walk on Mars.</p></div>}
      >
        <Suspense fallback={null}>
          {terrain && environment && <World terrain={terrain} environment={environment} playerRef={playerRef} onTelemetry={setTelemetry} onLockChange={setLocked} onInspect={setInspection} inspection={inspection} onReady={() => setLoading(false)} />}
        </Suspense>
      </Canvas>
    </SceneErrorBoundary>
    <Hud simulation={simulation} setParameter={simulationStore.setParameter} applyPreset={simulationStore.applyPreset} telemetry={telemetry} metadata={terrain?.metadata} locked={locked} loading={loading} loadError={loadError} onEnter={enter} onReset={reset} debug={debug} setDebug={setDebug} inspection={inspection} onClearInspection={() => setInspection(null)} />
  </main>;
}
