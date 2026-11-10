import { useMemo } from 'react'
import { Line } from '@react-three/drei'

export default function RouteBeacons({ route }) {
  const points = useMemo(() => route.points.map(({ x, y, z }) => [x, y + 0.12, z]), [route])
  const color = route.stop ? '#ffbe75' : '#8ef0d8'

  return <group name="expedition-route">
    <Line points={points} color={color} lineWidth={2.5} />
    <mesh position={[points[0][0], points[0][1] + 0.07, points[0][2]]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.85, 1.03, 24]} />
      <meshBasicMaterial color={color} transparent opacity={0.75} />
    </mesh>
    {route.waypoints.slice(1).map(({ x, y, z, label }, index) => (
      <group key={index} position={[x, y, z]}>
        <mesh position={[0, 1.65, 0]}>
          <cylinderGeometry args={[0.07, 0.10, 3.3, 8]} />
          <meshBasicMaterial color={color} />
        </mesh>
        <mesh position={[0, 3.55, 0]}>
          <octahedronGeometry args={[label === 'Destination' ? 0.58 : 0.38]} />
          <meshBasicMaterial color={color} />
        </mesh>
      </group>
    ))}
  </group>
}
