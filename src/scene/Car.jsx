const wheels = [[-1.05, -1.32], [1.05, -1.32], [-1.05, 1.27], [1.05, 1.27]]

export default function Car({ bodyRef, wheelRefs }) {
  return <group ref={bodyRef} name="mars-expedition-car">
    <mesh castShadow receiveShadow position={[0, 0.70, 0]}>
      <boxGeometry args={[1.88, 0.53, 3.50]} />
      <meshStandardMaterial color="#bc802e" roughness={0.56} />
    </mesh>
    <mesh castShadow position={[0, 1.11, -0.36]}>
      <boxGeometry args={[1.56, 0.66, 1.47]} />
      <meshStandardMaterial color="#263e44" metalness={0.35} roughness={0.35} />
    </mesh>
    <mesh castShadow position={[0, 1.46, -0.36]}>
      <boxGeometry args={[1.65, 0.12, 1.60]} />
      <meshStandardMaterial color="#e5b56d" roughness={0.65} />
    </mesh>
    <mesh castShadow position={[0, 0.99, 1.0]}>
      <boxGeometry args={[1.32, 0.29, 0.92]} />
      <meshStandardMaterial color="#5b5245" roughness={0.85} />
    </mesh>
    {[-0.61, 0.61].map((x) => <group key={x}>
      <mesh position={[x, 0.76, -1.77]}>
        <boxGeometry args={[0.32, 0.17, 0.07]} />
        <meshBasicMaterial color="#f6eab5" />
      </mesh>
      <mesh position={[x, 0.74, 1.77]}>
        <boxGeometry args={[0.25, 0.12, 0.07]} />
        <meshBasicMaterial color="#d35037" />
      </mesh>
    </group>)}
    {wheels.map(([x, z], i) => <group key={i} ref={(wheel) => { wheelRefs.current[i] = wheel }} position={[x, 0.45, z]}>
      <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.45, 0.45, 0.38, 18]} />
        <meshStandardMaterial color="#211e1c" roughness={1} />
      </mesh>
      <mesh position={[Math.sign(x) * 0.20, 0, 0]}>
        <boxGeometry args={[0.02, 0.09, 0.54]} />
        <meshStandardMaterial color="#9b8c75" roughness={0.5} />
      </mesh>
    </group>)}
  </group>
}
