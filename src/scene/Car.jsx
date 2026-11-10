import { useEffect, useMemo } from 'react';
import { BoxGeometry, CanvasTexture, ExtrudeGeometry, Shape, SRGBColorSpace, Vector2 } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const wheels = [[-1.05, -1.32], [1.05, -1.32], [-1.05, 1.27], [1.05, 1.27]];
const paint = '#e0c29a';
const safety = '#c64e23';
const frame = '#303335';
const tireProfile = [[0.23, -0.21], [0.35, -0.21], [0.418, -0.173], [0.438, -0.12],
  [0.438, 0.12], [0.418, 0.173], [0.35, 0.21], [0.23, 0.21]].map(([r, y]) => new Vector2(r, y));
const hullProfile = [[-1.76, 0.43], [-1.88, 0.61], [-1.78, 0.91], [-0.86, 0.97],
  [-0.36, 1.03], [0.96, 0.98], [1.7, 0.83], [1.84, 0.62], [1.65, 0.43]];
const glassProfile = [[-0.88, 0.91], [-0.72, 1.41], [-0.49, 1.62], [0.37, 1.62], [0.85, 1.45], [1.18, 0.91]];

function Panel({ size, position, rotation, color, bevel = 0.055, shadow = false }) {
  const [width, height, depth] = size;
  const geometry = useMemo(() => new RoundedBoxGeometry(width, height, depth, 1, bevel), [width, height, depth, bevel]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} position={position} rotation={rotation} castShadow={shadow}>
    <meshStandardMaterial color={color} roughness={0.68} />
  </mesh>;
}

function HullSection({ profile, width, color, roughness }) {
  const geometry = useMemo(() => {
    const shape = new Shape(profile.map(([x, y]) => new Vector2(x, y)));
    const edge = 0.04;
    const shell = new ExtrudeGeometry(shape, {
      depth: width - edge * 2, bevelEnabled: true, bevelThickness: edge,
      bevelSize: edge, bevelSegments: 2, steps: 1,
    });
    shell.translate(0, 0, -width / 2 + edge);
    shell.rotateY(Math.PI / 2);
    return shell;
  }, [profile, width]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} castShadow>
    <meshStandardMaterial color={color} roughness={roughness} />
  </mesh>;
}

function Wheel({ x, z, treads, wheelRef }) {
  const outside = Math.sign(x);
  return <group ref={wheelRef} position={[x, 0.45, z]}>
    <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
      <latheGeometry args={[tireProfile, 32]} />
      <meshStandardMaterial color="#27282a" roughness={0.99} />
    </mesh>
    <mesh geometry={treads}>
      <meshStandardMaterial color="#383734" roughness={0.96} />
    </mesh>
    <mesh position={[outside * 0.21, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.26, 0.26, 0.046, 20]} />
      <meshStandardMaterial color="#9b9182" roughness={0.67} />
    </mesh>
    <mesh position={[outside * 0.24, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.115, 0.155, 0.075, 8]} />
      <meshStandardMaterial color="#514b45" roughness={0.66} />
    </mesh>
  </group>;
}

function createPlate() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#282724';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#e0c29a';
  ctx.font = '700 43px monospace';
  ctx.fillText('ARES 07', 20, 46);
  ctx.fillStyle = '#e47940';
  ctx.fillRect(231, 12, 7, 39);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export default function Car({ bodyRef, wheelRefs }) {
  const plate = useMemo(createPlate, []);
  const treads = useMemo(() => {
    const blocks = Array.from({ length: 32 }, (_, i) => {
      const block = new BoxGeometry(0.19, 0.025, 0.075);
      block.rotateY(i % 2 ? 0.24 : -0.24);
      block.translate(i % 2 ? 0.085 : -0.085, 0.437, 0);
      block.rotateX(i * Math.PI / 16);
      return block;
    });
    const geometry = mergeGeometries(blocks);
    blocks.forEach((block) => block.dispose());
    return geometry;
  }, []);
  useEffect(() => () => { plate.dispose(); treads.dispose(); }, [plate, treads]);

  return <group ref={bodyRef} name="mars-expedition-car">
    <HullSection profile={hullProfile} width={1.82} color={paint} roughness={0.75} />
    <HullSection profile={glassProfile} width={1.48} color="#263c44" roughness={0.29} />
    <Panel size={[1.63, 0.14, 1.0]} position={[0, 1.63, 0.02]} color={paint} shadow />
    <Panel size={[1.67, 0.30, 1.02]} position={[0, 1.01, 1.15]} color={frame} shadow />
    <Panel size={[1.38, 0.15, 0.9]} position={[0, 1.19, 1.14]} color={safety} />
    <Panel size={[1.98, 0.22, 0.23]} position={[0, 0.48, 1.78]} color={frame} shadow />
    <Panel size={[1.87, 0.19, 0.21]} position={[0, 0.47, -1.79]} color={frame} shadow />
    <Panel size={[0.51, 0.18, 0.05]} position={[0, 0.73, 1.88]} color={frame} />
    <mesh position={[0, 0.73, 1.909]}>
      <planeGeometry args={[0.48, 0.12]} />
      <meshStandardMaterial map={plate} roughness={0.8} />
    </mesh>
    {[-1, 1].map((side) => <group key={side}>
      <Panel size={[0.18, 0.56, 0.13]} position={[side * 0.75, 1.27, 0.61]} rotation={[0.32, 0, 0]} color={paint} />
      <Panel size={[0.14, 0.19, 1.40]} position={[side * 0.94, 0.63, 0]} color={safety} />
      {[-1.32, 1.27].map((z) => <Panel key={z} size={[0.47, 0.14, 0.88]} position={[side * 1.05, 0.94, z]} color={frame} shadow />)}
      <mesh position={[side * 0.70, 0.71, 1.92]}>
        <boxGeometry args={[0.30, 0.09, 0.045]} />
        <meshStandardMaterial color="#ffb6a1" emissive="#ff4c28" emissiveIntensity={1.2} />
      </mesh>
      <mesh position={[side * 0.67, 0.71, -1.89]}>
        <boxGeometry args={[0.32, 0.105, 0.055]} />
        <meshStandardMaterial color="#fff0d6" emissive="#ffcd9e" emissiveIntensity={0.65} />
      </mesh>
    </group>)}
    <group position={[-0.48, 1.69, 0.24]}>
      <Panel size={[0.24, 0.12, 0.24]} position={[0, 0.04, 0]} color={frame} />
      <mesh position={[0, 0.26, 0]}>
        <cylinderGeometry args={[0.022, 0.035, 0.46, 8]} />
        <meshStandardMaterial color="#77766c" roughness={0.6} />
      </mesh>
      <Panel size={[0.30, 0.13, 0.18]} position={[0, 0.49, -0.02]} color={paint} />
      <mesh position={[0, 0.49, -0.12]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.044, 0.044, 0.04, 14]} />
        <meshStandardMaterial color="#244a52" roughness={0.31} />
      </mesh>
    </group>
    {wheels.map(([x, z], i) => <Wheel key={i} x={x} z={z} treads={treads} wheelRef={(wheel) => { wheelRefs.current[i] = wheel; }} />)}
  </group>;
}
