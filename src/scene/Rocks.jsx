import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, DodecahedronGeometry, Object3D } from 'three';

const TILE = 30;
const REACH = 2;
const STONES_PER_TILE = 64;
const CAPACITY = (REACH * 2 + 1) ** 2 * STONES_PER_TILE;

export default function Rocks({ terrain }) {
  const mesh = useRef();
  const last = useRef({ terrain: null, column: NaN, row: NaN });
  const geometry = useMemo(() => {
    const rock = new DodecahedronGeometry(1, 0);
    const position = rock.attributes.position;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
      const irregularity = 1 + 0.13 * Math.sin(x * 27 + y * 16 + z * 31);
      position.setXYZ(i, x * irregularity, y * irregularity, z * irregularity);
    }
    rock.computeVertexNormals();
    const normal = rock.attributes.normal;
    for (let i = 0; i < normal.count; i++) {
      const x = normal.getX(i) * 0.72 + position.getX(i) * 0.28;
      const y = normal.getY(i) * 0.72 + position.getY(i) * 0.28;
      const z = normal.getZ(i) * 0.72 + position.getZ(i) * 0.28;
      const length = Math.hypot(x, y, z);
      normal.setXYZ(i, x / length, y / length, z / length);
    }
    return rock;
  }, []);
  const object = useMemo(() => new Object3D(), []);
  const color = useMemo(() => new Color(), []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(({ camera }) => {
    const column = Math.floor(camera.position.x / TILE);
    const row = Math.floor(camera.position.z / TILE);
    if (last.current.terrain === terrain && last.current.column === column && last.current.row === row) return;
    last.current = { terrain, column, row };

    let count = 0;
    for (let tileZ = row - REACH; tileZ <= row + REACH; tileZ++) {
      for (let tileX = column - REACH; tileX <= column + REACH; tileX++) {
        let seed = Math.imul(tileX, 73856093) ^ Math.imul(tileZ, 19349663) ^ 90210;
        const random = () => {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          return seed / 4294967296;
        };
        for (let i = 0; i < STONES_PER_TILE; i++) {
          const x = (tileX + random()) * TILE;
          const z = (tileZ + random()) * TILE;
          const radius = 0.045 + random() ** 3.3 * 0.22;
          const yaw = random() * Math.PI * 2;
          const stretch = 1.15 + random() * 0.65;
          const shade = random();
          if (!terrain.contains(x, z)) continue;
          object.position.set(x, terrain.sampleHeight(x, z) + radius * 0.20, z);
          object.rotation.set(shade * 0.32, yaw, shade * 0.45);
          object.scale.set(radius * stretch, radius * 0.66, radius);
          object.updateMatrix();
          mesh.current.setMatrixAt(count, object.matrix);
          mesh.current.setColorAt(count, color.setHSL(0.035 + shade * 0.045, 0.19 + shade * 0.10, 0.17 + shade * 0.18));
          count++;
        }
      }
    }
    mesh.current.count = count;
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  });

  // Stable visual dressing follows the observer at either site. The DEM and
  // obstacle data remain the sources for surface contact and route hazards.
  return <instancedMesh ref={mesh} args={[geometry, null, CAPACITY]} frustumCulled={false} castShadow receiveShadow>
    <meshStandardMaterial roughness={0.96} />
  </instancedMesh>;
}
