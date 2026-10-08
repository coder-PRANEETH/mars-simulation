import { useEffect, useMemo, useRef } from 'react';
import { Color, DodecahedronGeometry, Object3D } from 'three';

export default function Rocks({ terrain }) {
  const ref = useRef();
  const count = 1600;
  const geometry = useMemo(() => {
    const rock = new DodecahedronGeometry(1, 0);
    const position = rock.attributes.position;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
      const irregularity = 1 + 0.13 * Math.sin(x * 27 + y * 16 + z * 31);
      position.setXYZ(i, x * irregularity, y * irregularity, z * irregularity);
    }
    rock.computeVertexNormals();
    return rock;
  }, []);
  useEffect(() => {
    const object = new Object3D();
    let seed = 90210;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const spawn = terrain.metadata.spawn ?? { x: 0, z: 0 };
    for (let i = 0; i < count; i++) {
      const local = i < 1100;
      const x = local ? spawn.x + (random() - 0.5) * 260 : (random() - 0.5) * terrain.metadata.widthMeters;
      const z = local ? spawn.z + (random() - 0.5) * 260 : (random() - 0.5) * terrain.metadata.depthMeters;
      const radius = 0.035 + random() ** 3 * 0.16;
      object.position.set(x, terrain.sampleHeight(x, z) + radius * 0.32, z);
      object.rotation.set(random(), random() * Math.PI, random() * 0.4);
      object.scale.set(radius * (1 + random()), radius * 0.7, radius * (0.8 + random()));
      object.updateMatrix();
      ref.current.setMatrixAt(i, object.matrix);
      ref.current.setColorAt(i, new Color().setHSL(0.07 + random() * 0.025, 0.16, 0.16 + random() * 0.09));
    }
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.instanceColor.needsUpdate = true;
    ref.current.computeBoundingSphere();
    return () => geometry.dispose();
  }, [terrain, geometry]);
  // Sub-metre illustrative dressing, deliberately too small to be obstacles.
  // These positions are not geological observations; the HiRISE DEM is untouched.
  return <instancedMesh ref={ref} args={[geometry, null, count]} castShadow receiveShadow>
    <meshStandardMaterial color="#ada395" roughness={1} />
  </instancedMesh>;
}
