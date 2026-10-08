import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Color, BackSide, FogExp2, MathUtils, Vector3 } from 'three';
import Terrain from './Terrain.jsx';
import Player from './Player.jsx';
import Rocks from './Rocks.jsx';
import Dust from './Dust.jsx';

const dustStrength = { none: 0, low: 0.2, medium: 0.45, high: 0.75, storm: 1 };

function Atmosphere({ environment }) {
  const { scene, camera } = useThree();
  const sky = useRef();
  const light = useRef();
  const target = useRef();
  const uniforms = useMemo(() => ({
    horizonColor: { value: new Color('#d9b48a') },
    zenithColor: { value: new Color('#8b7169') },
    sunDirection: { value: new Vector3(-0.65, 0.65, -0.4).normalize() },
  }), []);
  useEffect(() => { scene.fog = new FogExp2('#c1a080', 0.00055); return () => { scene.fog = null; }; }, [scene]);
  useFrame((_, dt) => {
    const state = environment.getState();
    const dust = dustStrength[state.dustLevel] ?? 0.45;
    // Optical artist model: density + wind lofting make haze responsive; this is
    // intentionally not radiative transfer or a Mars atmospheric weather solver.
    const density = Math.sqrt(state.atmosphericDensity / 0.016);
    const desiredFog = 0.00011 + dust * dust * 0.009 * Math.min(1.7, density) * (0.8 + state.windSpeed / 300);
    scene.fog.density = MathUtils.damp(scene.fog.density, desiredFog, 3, dt);
    sky.current.position.copy(camera.position);
    light.current.position.set(camera.position.x - 80, camera.position.y + 100, camera.position.z - 50);
    target.current.position.set(camera.position.x, camera.position.y - 10, camera.position.z);
    light.current.target = target.current;
    light.current.intensity = MathUtils.damp(light.current.intensity, 2.5 - dust * 0.9, 2, dt);
  });
  return <>
    <mesh ref={sky} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[5000, 24, 16]} />
      <shaderMaterial uniforms={uniforms} side={BackSide} depthWrite={false}
        vertexShader={'varying vec3 direction; void main() { direction = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'}
        fragmentShader={`varying vec3 direction; uniform vec3 horizonColor; uniform vec3 zenithColor; uniform vec3 sunDirection;
          void main() {
            vec3 d = normalize(direction);
            float height = pow(max(d.y, 0.0), 0.55);
            vec3 sky = mix(horizonColor, zenithColor, height);
            float sun = smoothstep(0.99990, 0.99996, dot(d, sunDirection));
            float halo = pow(max(dot(d, sunDirection), 0.0), 250.0);
            gl_FragColor = vec4(sky + vec3(0.5,0.36,0.22) * halo + vec3(2.0,1.8,1.5)*sun, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`} />
    </mesh>
    <hemisphereLight args={['#d2b99f', '#6b4830', 1.4]} />
    <directionalLight ref={light} castShadow intensity={2.4} color="#fff0d5"
      shadow-mapSize={[1024, 1024]} shadow-camera-left={-65} shadow-camera-right={65}
      shadow-camera-top={65} shadow-camera-bottom={-65} shadow-camera-near={1} shadow-camera-far={350}
      shadow-bias={-0.00015} shadow-normalBias={0.12} />
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

export default function World({ terrain, environment, playerRef, onTelemetry, onLockChange, onInspect, inspection, onReady }) {
  useEffect(() => { onReady(); }, []);
  return <>
    <Atmosphere environment={environment} />
    <Terrain terrain={terrain} />
    <Rocks terrain={terrain} />
    <Dust environment={environment} />
    <Player terrain={terrain} environment={environment} resetRef={playerRef} onTelemetry={onTelemetry} onLockChange={onLockChange} onInspect={onInspect} />
    <InspectionMarker inspection={inspection} />
  </>;
}
