import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry, CanvasTexture } from 'three';

const levels = { none: 0, low: 0.12, medium: 0.3, high: 0.6, storm: 1 };

export default function Dust({ environment }) {
  const ref = useRef();
  const count = 650;
  const { geometry, velocities, texture } = useMemo(() => {
    const geometry = new BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 80;
      positions[i * 3 + 1] = (Math.random() - 0.2) * 24;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 80;
      velocities[i] = 0.5 + Math.random() * 0.5;
    }
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 32;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255,255,255,.6)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);
    return { geometry, velocities, texture: new CanvasTexture(canvas) };
  }, []);
  useEffect(() => () => { geometry.dispose(); texture.dispose(); }, [geometry, texture]);
  useFrame(({ camera, clock }, dt) => {
    const state = environment.getState();
    const level = levels[state.dustLevel] ?? 0.3;
    ref.current.visible = level > 0;
    if (!level) return;
    const wind = environment.getWind();
    const entrainment = Math.min(2.5, Math.sqrt(state.atmosphericDensity / 0.016));
    const positions = geometry.attributes.position.array;
    for (let i = 0; i < count; i++) {
      const index = i * 3;
      positions[index] += wind.x * dt * velocities[i] * entrainment;
      positions[index + 2] += wind.z * dt * velocities[i] * entrainment;
      positions[index + 1] += (Math.sin(clock.elapsedTime + i) * 0.25 + wind.speed * 0.012 * entrainment) * dt;
      positions[index] = ((positions[index] + 40) % 80 + 80) % 80 - 40;
      positions[index + 2] = ((positions[index + 2] + 40) % 80 + 80) % 80 - 40;
      if (positions[index + 1] > 20) positions[index + 1] = -4;
    }
    ref.current.position.copy(camera.position);
    ref.current.material.opacity = 0.12 + level * 0.48;
    ref.current.material.size = 0.1 + level * 0.28;
    geometry.setDrawRange(0, Math.round(count * level));
    geometry.attributes.position.needsUpdate = true;
  });
  return <points name="mars-dust" ref={ref} geometry={geometry} frustumCulled={false}>
    <pointsMaterial color="#c6ad8b" map={texture} size={0.15} transparent opacity={0.25} depthWrite={false} sizeAttenuation />
  </points>;
}
