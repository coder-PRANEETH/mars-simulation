import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Color, BackSide, FogExp2, MathUtils, Vector3 } from 'three';
import Terrain from './Terrain.jsx';
import Player from './Player.jsx';
import Rocks from './Rocks.jsx';
import Dust from './Dust.jsx';
import RouteBeacons from '../planner/RouteBeacons.jsx';

const sunlight = new Vector3(-0.91, 0.33, -0.37).normalize();
const dustStrength = { none: 0, low: 0.2, medium: 0.45, high: 0.75, storm: 1 };

function Atmosphere({ environment }) {
  const { scene, camera } = useThree();
  const sky = useRef();
  const light = useRef();
  const target = useRef();
  const uniforms = useMemo(() => ({
    horizonColor: { value: new Color('#db9b70') },
    zenithColor: { value: new Color('#684e54') },
    sunDirection: { value: sunlight },
    aerosol: { value: 0.45 },
  }), []);
  useEffect(() => { scene.fog = new FogExp2('#ca9070', 0.00055); return () => { scene.fog = null; }; }, [scene]);
  useFrame((_, dt) => {
    const state = environment.getState();
    const dust = dustStrength[state.dustLevel] ?? 0.45;
    // Optical artist model: density + wind lofting make haze responsive; this is
    // intentionally not radiative transfer or a Mars atmospheric weather solver.
    const density = Math.sqrt(state.atmosphericDensity / 0.016);
    const desiredFog = 0.000085 + dust ** 3.4 * 0.009 * Math.min(1.7, density) * (0.8 + state.windSpeed / 300);
    scene.fog.density = MathUtils.damp(scene.fog.density, desiredFog, 3, dt);
    uniforms.aerosol.value = MathUtils.damp(uniforms.aerosol.value, dust, 3, dt);
    sky.current.position.copy(camera.position);
    target.current.position.copy(camera.position);
    target.current.position.y -= 3;
    light.current.position.copy(target.current.position).addScaledVector(sunlight, 145);
    light.current.target = target.current;
    light.current.intensity = MathUtils.damp(light.current.intensity, 3.7 - dust * 2.1, 2, dt);
  });
  return <>
    <mesh ref={sky} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[5000, 24, 16]} />
      <shaderMaterial uniforms={uniforms} side={BackSide} depthWrite={false}
        vertexShader={'varying vec3 direction; void main() { direction = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'}
        fragmentShader={`
          varying vec3 direction;
          uniform vec3 horizonColor;
          uniform vec3 zenithColor;
          uniform vec3 sunDirection;
          uniform float aerosol;

          float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float noise(vec2 p) {
            vec2 i = floor(p), f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
              mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), f.x), f.y);
          }

          void main() {
            vec3 d = normalize(direction);
            float height = smoothstep(-0.02, 0.68, d.y);
            float angle = max(dot(d, sunDirection), 0.0);
            vec3 sky = mix(horizonColor, zenithColor, height);
            vec2 bands = vec2(dot(d.xz, vec2(0.83, 0.55)) * 8.0, d.y * 36.0);
            float drift = noise(bands) * 0.68 + noise(bands * 2.13) * 0.32;
            float haze = (1.0 - smoothstep(0.0, 0.33, d.y)) * (0.46 + aerosol * 0.45);
            sky += vec3(0.24, 0.108, 0.037) * haze;
            sky += vec3(0.11, 0.059, 0.035) * (drift - 0.45) * smoothstep(-0.025, 0.09, d.y);
            sky += vec3(0.18, 0.075, 0.025) * pow(angle, 6.0);
            sky += vec3(0.19, 0.31, 0.45) * pow(angle, 62.0) * (1.0 - aerosol * 0.4);
            float disc = smoothstep(0.99989, 0.99996, angle);
            sky += disc * vec3(3.8, 3.0, 2.3) * (1.0 - 0.68 * aerosol);
            gl_FragColor = vec4(sky, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`} />
    </mesh>
    <hemisphereLight args={['#b8bdd3', '#684533', 1.08]} />
    <directionalLight position={[6, 4, 9]} intensity={0.34} color="#a9c4e4" />
    <directionalLight ref={light} castShadow intensity={3.5} color="#ffdbb3"
      shadow-mapSize={[1024, 1024]} shadow-camera-left={-65} shadow-camera-right={65}
      shadow-camera-top={65} shadow-camera-bottom={-65} shadow-camera-near={1} shadow-camera-far={350}
      shadow-bias={-0.00015} shadow-normalBias={0.075} />
    <object3D ref={target} />
  </>;
}

function InspectionMarker({ inspection }) {
  const marker = useRef();
  useFrame(({ clock }) => { if (marker.current) marker.current.rotation.y = clock.elapsedTime * 0.4; });
  if (!inspection?.point) return null;
  const point = inspection.point;
  return <group position={[point.x, point.y + 0.08, point.z]}>
    <mesh ref={marker} position={[0, 0.45, 0]}>
      <octahedronGeometry args={[0.16, 0]} />
      <meshBasicMaterial color="#eee0be" wireframe depthTest={false} />
    </mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.24, 0.28, 32]} />
      <meshBasicMaterial color="#eee0be" depthTest={false} transparent opacity={0.8} />
    </mesh>
  </group>;
}

export default function World({ driving, carActive, onPauseCar, route, terrain, environment, playerRef, onTelemetry, onLockChange, onInspect, inspection, onReady }) {
  useEffect(() => { onReady(); }, []);
  return <>
    <Atmosphere environment={environment} />
    <Terrain terrain={terrain} />
    <Rocks terrain={terrain} />
    <Dust environment={environment} />
    <Player driving={driving} carActive={carActive} onPauseCar={onPauseCar} terrain={terrain} environment={environment} resetRef={playerRef} onTelemetry={onTelemetry} onLockChange={onLockChange} onInspect={onInspect} />
    <InspectionMarker inspection={inspection} />
    {route && <RouteBeacons route={route} />}
  </>;
}
