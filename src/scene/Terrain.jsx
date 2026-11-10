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

function createRegolithTexture() {
  const canvas = document.createElement('canvas');
  const size = 256;
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  const pixels = context.createImageData(size, size);
  let seed = 4217;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const noiseLayers = [8, 32, 64].map((width) => ({
    width, values: Float32Array.from({ length: width * width }, random),
  }));
  function noise({ width, values }, x, y) {
    const u = x * width / size, v = y * width / size;
    const column = Math.floor(u), row = Math.floor(v);
    const blend = (t) => t * t * (3 - 2 * t);
    const sx = blend(u - column), sy = blend(v - row);
    const nextColumn = (column + 1) % width;
    const nextRow = (row + 1) % width;
    const top = values[row * width + column] * (1 - sx) + values[row * width + nextColumn] * sx;
    const bottom = values[nextRow * width + column] * (1 - sx) + values[nextRow * width + nextColumn] * sx;
    return top * (1 - sy) + bottom * sy;
  }

  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const [coarse, grit, fine] = noiseLayers.map((layer) => noise(layer, x, y));
    const offset = (y * size + x) * 4;
    pixels.data[offset] = 255 * (coarse * 0.25 + grit * 0.32 + fine * 0.31 + random() * 0.12);
    pixels.data[offset + 1] = 255 * (coarse * 0.32 + grit * 0.51 + fine * 0.17);
    pixels.data[offset + 2] = 255 * coarse;
    pixels.data[offset + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);

  const texture = new CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

export default function Terrain({ terrain }) {
  const texture = useTexture(`${terrain.assetBase}/texture.jpg`);
  const geometry = useMemo(() => buildTerrainGeometry(terrain), [terrain]);
  const { widthMeters, depthMeters } = terrain.metadata;
  const grain = useMemo(() => {
    const detail = createRegolithTexture();
    detail.repeat.set(widthMeters / 2.5, depthMeters / 2.5);
    return detail;
  }, [widthMeters, depthMeters]);
  useEffect(() => {
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
    return () => { geometry.dispose(); grain.dispose(); };
  }, [texture, geometry, grain]);

  // Modulate the source imagery with illustrative grit at metre and centimetre
  // scales. All relief at those scales is material shading.
  const shadeRegolith = (shader) => {
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <map_fragment>', `
        #include <map_fragment>
        vec2 localUv = vBumpMapUv;
        float grit = texture2D(bumpMap, localUv).g;
        float patches = texture2D(bumpMap, localUv * 0.1875 + vec2(0.17, 0.36)).b;
        float fade = 1.0 - smoothstep(30.0, 210.0, length(vViewPosition));
        vec3 detail = mix(vec3(0.65, 0.51, 0.44), vec3(1.38, 1.29, 1.16), grit * 0.7 + patches * 0.3);
        diffuseColor.rgb *= mix(vec3(1.0), detail, fade);
      `);
  };

  return <mesh name="mars-terrain" geometry={geometry} receiveShadow>
    <meshStandardMaterial map={texture} color="#e5ae87" roughness={0.94} bumpMap={grain} bumpScale={0.20}
      onBeforeCompile={shadeRegolith} />
  </mesh>;
}
