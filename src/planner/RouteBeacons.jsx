import { useMemo } from 'react'
import { Line } from '@react-three/drei'

export default function RouteBeacons({ route }) {
  const points = useMemo(() => route.points.map(({ x, y, z }) => [x, y + 0.12, z]), [route])
  const color = route.stop ? '#ffbe75' : '#8ef0d8'

  return <group name="expedition-route">
    <Line points={points} color={color} lineWidth={2.5} />
    {route.waypoints.map(({ x, y, z, label }, index) => (
      <group key={index} position={[x, y, z]}>
        <mesh position={[0, 1.65, 0]}>
          <cylinderGeometry args={[0.07, 0.10, 3.3, 8]} />
          <meshBasicMaterial color={color} />
        </mesh>
        <mesh position={[0, 3.55, 0]}>
          <octahedronGeometry args={[label === 'Destination' || label === 'Start' ? 0.58 : 0.38]} />
          <meshBasicMaterial color={color} />
        </mesh>
      </group>
    ))}
  </group>
}
