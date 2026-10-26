import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const COUNT = 8000;

const vert = /* glsl */ `
  uniform float uTime; uniform float uHeat;
  attribute float aSeed; attribute float aH;
  varying float vH; varying float vSeed;
  void main() {
    vH = aH; vSeed = aSeed;
    vec3 p = position;
    float pulse = sin(uTime * 1.6 + aSeed * 6.28 + length(p.xz) * 0.25) * 0.5 + 0.5;
    p.y += pulse * 0.08 * (1.0 + uHeat * 2.0) * step(0.01, aH);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = (1.6 + pulse * 1.4 + uHeat * aH * 1.5) * (22.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }`;
const frag = /* glsl */ `
  uniform float uHeat; uniform vec3 uCool; uniform vec3 uWarm; uniform vec3 uHot;
  varying float vH; varying float vSeed;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    vec3 c = mix(uCool, uWarm, clamp(vH * 0.35 + vSeed * 0.2, 0.0, 1.0));
    c = mix(c, uHot, clamp(uHeat * (vH * 0.5 + 0.2) * step(0.6, vSeed + uHeat * 0.4), 0.0, 1.0));
    gl_FragColor = vec4(c, (1.0 - d * 2.0) * 0.9);
  }`;

function Points({ heat, push }: { heat: { current: number }; push: { current: number } }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const group = useRef<THREE.Group>(null);
  const geo = useMemo(() => {
    const pos = new Float32Array(COUNT * 3);
    const seed = new Float32Array(COUNT);
    const h = new Float32Array(COUNT);
    let i = 0;
    // seeded RNG for determinism
    let s = 7;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const blocks: { x: number; z: number; w: number; d: number; hgt: number }[] = [];
    for (let bx = -10; bx < 10; bx++)
      for (let bz = -10; bz < 10; bz++) {
        if (rnd() < 0.18) continue;
        const dist = Math.hypot(bx, bz);
        blocks.push({
          x: bx * 2.2,
          z: bz * 2.2,
          w: 0.6 + rnd() * 1.2,
          d: 0.6 + rnd() * 1.2,
          hgt: Math.max(0.2, (1 - dist / 14) * (0.5 + rnd() * 4)),
        });
      }
    while (i < COUNT) {
      const ground = rnd() < 0.35;
      if (ground) {
        pos.set([(rnd() - 0.5) * 46, 0, (rnd() - 0.5) * 46], i * 3);
        h[i] = 0;
      } else {
        const b = blocks[Math.floor(rnd() * blocks.length)]!;
        const face = rnd();
        const y = rnd() * b.hgt;
        const x = b.x + (face < 0.5 ? (rnd() - 0.5) * b.w : (rnd() < 0.5 ? -0.5 : 0.5) * b.w);
        const z = b.z + (face < 0.5 ? (rnd() < 0.5 ? -0.5 : 0.5) * b.d : (rnd() - 0.5) * b.d);
        pos.set([x, y, z], i * 3);
        h[i] = y / 4;
      }
      seed[i] = rnd();
      i++;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    g.setAttribute("aH", new THREE.BufferAttribute(h, 1));
    return g;
  }, []);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uHeat: { value: 0 },
      uCool: { value: new THREE.Color("#2DD4BF").multiplyScalar(0.55) },
      uWarm: { value: new THREE.Color("#F5A623") },
      uHot: { value: new THREE.Color("#E5484D") },
    }),
    [],
  );
  const mouse = useRef({ x: 0, y: 0 });
  useFrame((state, raw) => {
    const dt = Math.min(raw, 0.05);
    if (!mat.current || !group.current) return;
    mat.current.uniforms["uTime"]!.value += dt;
    const u = mat.current.uniforms["uHeat"]!;
    u.value += (heat.current - u.value) * (1 - Math.exp(-3 * dt));
    group.current.rotation.y += dt * 0.03;
    mouse.current.x += (state.pointer.x - mouse.current.x) * (1 - Math.exp(-2 * dt));
    mouse.current.y += (state.pointer.y - mouse.current.y) * (1 - Math.exp(-2 * dt));
    const r = 30 - push.current * 12;
    state.camera.position.set(mouse.current.x * 3, 12 - push.current * 3 + mouse.current.y * 2, r);
    state.camera.lookAt(0, 1, 0);
  });
  return (
    <group ref={group}>
      <points geometry={geo}>
        <shaderMaterial
          ref={mat}
          vertexShader={vert}
          fragmentShader={frag}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

/** Fixed background point-cloud city; `heat` (0..1) reddens it, `push` (0..1) dollies the camera in. */
export default function PointCity({
  heat,
  push,
}: {
  heat: { current: number };
  push: { current: number };
}) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 12, 30], fov: 50 }}
      gl={{ antialias: false, alpha: true }}
    >
      <fog attach="fog" args={["#070A0F", 20, 60]} />
      <Points heat={heat} push={push} />
    </Canvas>
  );
}
