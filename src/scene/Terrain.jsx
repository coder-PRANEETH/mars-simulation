import { useEffect, useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import { BufferAttribute, BufferGeometry, CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';

export function buildTerrainGeometry(terrain) {
  const { columns, rows, widthMeters, depthMeters } = terrain.metadata;
  const positions = new Float32Array(columns * rows * 3);
  const uv = new Float32Array(columns * rows * 2);
  const indices = new Uint32Array((columns - 1) * (rows - 1) * 6);
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const index = row * columns + col;
    positions[index * 3] = col / (columns - 1) * widthMeters - widthMeters / 2;
    positions[index * 3 + 1] = terrain.heights[index];
    positions[index * 3 + 2] = row / (rows - 1) * depthMeters - depthMeters / 2;
    uv[index * 2] = col / (columns - 1);
    uv[index * 2 + 1] = 1 - row / (rows - 1);
  }
  let cursor = 0;
  for (let row = 0; row < rows - 1; row++) for (let col = 0; col < columns - 1; col++) {
    const a = row * columns + col, b = a + 1, c = a + columns, d = c + 1;
    indices.set([a, c, b, b, c, d], cursor);
    cursor += 6;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new BufferAttribute(uv, 2));
  geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function createGrainTexture(widthMeters, depthMeters) {
  // Illustrative sub-DEM surface roughness: shading only, never elevation data.
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  const pixels = context.createImageData(128, 128);
  let seed = 4217;
  for (let i = 0; i < pixels.data.length; i += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const shade = 85 + (seed >>> 25);
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = shade;
    pixels.data[i + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  const texture = new CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(widthMeters / 3, depthMeters / 3);
  texture.anisotropy = 4;
  return texture;
}

export default function Terrain({ terrain }) {
  const texture = useTexture('/terrain/texture.jpg');
  const geometry = useMemo(() => buildTerrainGeometry(terrain), [terrain]);
  const grain = useMemo(() => createGrainTexture(terrain.metadata.widthMeters, terrain.metadata.depthMeters), [terrain]);
  useEffect(() => {
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
    return () => { geometry.dispose(); grain.dispose(); };
  }, [texture, geometry, grain]);
  return <mesh name="mars-terrain" geometry={geometry} receiveShadow>
    <meshStandardMaterial map={texture} color="#ce9469" roughness={0.96} metalness={0} bumpMap={grain} bumpScale={0.085} />
  </mesh>;
}
