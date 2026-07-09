import { useRef, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Line } from "@react-three/drei";
import * as THREE from "three";
import type { PatternResult } from "../api/client";

function PatternMesh({ pattern }: { pattern: PatternResult | null }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const geo = useMemo(() => {
    if (!pattern || pattern.pattern_db.length < 2) return null;

    const theta = pattern.theta_deg;
    const phi = pattern.phi_deg;
    const data = pattern.pattern_db;
    const nT = theta.length;
    const nP = phi.length;

    const verts: number[] = [];
    const cols: number[] = [];
    const idx: number[] = [];

    for (let i = 0; i < nT; i++) {
      for (let j = 0; j < nP; j++) {
        const el = THREE.MathUtils.degToRad(theta[i]);
        const az = THREE.MathUtils.degToRad(phi[j]);
        const lg = Math.pow(10, (data[i]?.[j] ?? -150) / 20);
        const r = 0.08 + lg * 5.0;

        verts.push(r * Math.sin(el) * Math.cos(az), r * Math.cos(el), r * Math.sin(el) * Math.sin(az));

        const gain = Math.max(0, ((data[i]?.[j] ?? -40) + 40) / 40);
        const c = new THREE.Color();
        c.setHSL(0.67 - gain * 0.67, 0.9, 0.2 + gain * 0.6);
        cols.push(c.r, c.g, c.b);
      }
    }

    for (let i = 0; i < nT - 1; i++) {
      for (let j = 0; j < nP - 1; j++) {
        const a = i * nP + j, b = a + 1, cc = a + nP, d = cc + 1;
        idx.push(a, b, d, a, d, cc);
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, [pattern]);

  if (!geo) return null;

  return (
    <mesh ref={meshRef} geometry={geo}>
      <meshPhongMaterial vertexColors side={THREE.DoubleSide} transparent opacity={0.75} shininess={30} />
    </mesh>
  );
}

function BeamRay({ thetaDeg, phiDeg }: { thetaDeg: number; phiDeg: number }) {
  const points = useMemo(() => {
    const t = THREE.MathUtils.degToRad(thetaDeg);
    const p = THREE.MathUtils.degToRad(phiDeg);
    const dir = new THREE.Vector3(Math.sin(t) * Math.cos(p), Math.cos(t), Math.sin(t) * Math.sin(p));
    return [new THREE.Vector3(0, 0, 0), dir.clone().multiplyScalar(6)];
  }, [thetaDeg, phiDeg]);

  return (
    <group>
      <Line points={points} color="#ff5252" lineWidth={2} />
      <mesh position={points[1].clone().multiplyScalar(0.6)}>
        <coneGeometry args={[0.25, 0.8, 16]} />
        <meshPhongMaterial color="#ff5252" emissive="#660000" emissiveIntensity={0.5} transparent opacity={0.75} />
      </mesh>
    </group>
  );
}

function ArrayElements({ nx, ny, dx, dy, geometry }: { nx: number; ny: number; dx: number; dy: number; geometry: string }) {
  const elements = useMemo(() => {
    const pos: [number, number, number][] = [];
    if (geometry === "rectangular") {
      for (let i = 0; i < ny; i++)
        for (let j = 0; j < nx; j++)
          pos.push([(j - (nx - 1) / 2) * dx, 0, (i - (ny - 1) / 2) * dy]);
    } else if (geometry === "circular") {
      for (let r = 1, rings = Math.min(nx, ny); r <= rings; r++) {
        const n = Math.max(6, Math.round(2 * Math.PI * r + 1));
        for (let i = 0; i < n; i++) {
          const a = (2 * Math.PI * i) / n;
          pos.push([r * dx * Math.cos(a), 0, r * dx * Math.sin(a)]);
        }
      }
    } else {
      for (let i = 0; i < ny; i++)
        for (let j = 0; j < nx; j++)
          pos.push([(j - (nx - 1) / 2) * dx + (i % 2) * dx / 2, 0, (i - (ny - 1) / 2) * dy * Math.sqrt(3) / 2]);
    }
    return pos;
  }, [nx, ny, dx, dy, geometry]);

  return (
    <group>
      {elements.map(([x, y, z], i) => (
        <group key={i} position={[x, y, z]}>
          <mesh>
            <cylinderGeometry args={[0.06, 0.06, 0.25, 12]} />
            <meshPhongMaterial color="#4fc3f7" emissive="#0d47a1" emissiveIntensity={0.4} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.09, 12, 12]} />
            <meshBasicMaterial color="#4fc3f7" transparent opacity={0.25} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

interface Viewer3DProps {
  pattern: PatternResult | null;
  thetaDeg: number;
  phiDeg: number;
  arrayConfig?: { nx: number; ny: number; dx: number; dy: number; geometry: string };
}

export function Viewer3D({ pattern, thetaDeg, phiDeg, arrayConfig }: Viewer3DProps) {
  const cfg = arrayConfig || { nx: 8, ny: 8, dx: 0.5, dy: 0.5, geometry: "rectangular" };

  return (
    <Canvas camera={{ position: [6, 4, 10], fov: 60 }} style={{ background: "#0d1117" }}>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 15, 10]} intensity={0.7} />
      <pointLight position={[0, 5, 0]} intensity={1.5} color="#4fc3f7" />
      <gridHelper args={[14, 14, 0x333355, 0x1a1a33]} />
      <axesHelper args={[4]} />
      <OrbitControls enableDamping dampingFactor={0.08} minDistance={2} maxDistance={40} />
      <PatternMesh pattern={pattern} />
      <BeamRay thetaDeg={thetaDeg} phiDeg={phiDeg} />
      <ArrayElements {...cfg} />
    </Canvas>
  );
}
