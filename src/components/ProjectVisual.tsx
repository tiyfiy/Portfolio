"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { prefersReducedMotion } from "@/lib/split";
import type { ProjectVisualKind } from "@/lib/data";

gsap.registerPlugin(ScrollTrigger);

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uAssemble; // 0 = scattered cloud, 1 = shape
  uniform float uPixelRatio;
  uniform float uSwell;    // heartbeat (pulse variant only)
  uniform vec3  uHit;          // cursor blast point, world space
  uniform float uHitStrength;  // 0 = no blast
  attribute vec3 aScatter;
  attribute float aRand;
  attribute float aBright;
  attribute float aFlow;   // 0..1 position along an arc, -1 elsewhere
  varying float vBright;
  varying float vT;
  varying float vHit;

  void main() {
    // each particle assembles on its own slice of the progress
    float t = smoothstep(aRand * 0.5, aRand * 0.5 + 0.5, uAssemble);
    vec3 p = mix(aScatter, position, t);

    // idle breathing
    p += 0.018 * vec3(
      sin(uTime * 1.3 + aRand * 43.0),
      cos(uTime * 1.1 + aRand * 31.0),
      sin(uTime * 1.7 + aRand * 17.0)
    );

    // heartbeat swell
    p *= 1.0 + uSwell * sin(uTime * 2.4 + position.y * 1.8) * 0.06;

    float bright = aBright;
    if (aFlow >= 0.0) {
      // a comet of light travelling along the arc
      float d = fract(aFlow - uTime * 0.1);
      bright += smoothstep(0.18, 0.0, d) * 1.4;
    }
    vBright = bright;
    vT = t;

    // cursor blast: particles near the hit point burst outward with
    // per-particle jitter and ease back as the force decays
    vec4 w = modelMatrix * vec4(p, 1.0);
    vec3 toP = w.xyz - uHit;
    float force = uHitStrength * exp(-dot(toP, toP) * 5.0);
    vec3 jitter = vec3(sin(aRand * 53.0), cos(aRand * 37.0), sin(aRand * 71.0));
    w.xyz += (normalize(toP + vec3(0.001)) + 0.6 * jitter) * force * (0.4 + 0.6 * aRand);
    vHit = clamp(force * 1.6, 0.0, 1.0);

    vec4 mv = viewMatrix * w;
    gl_Position = projectionMatrix * mv;
    gl_PointSize = 2.2 * uPixelRatio * (3.4 / -mv.z) * (0.6 + 0.4 * t);
  }
`;

const fragmentShader = /* glsl */ `
  precision mediump float;
  varying float vBright;
  varying float vT;
  varying float vHit;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    if (length(uv) > 0.5) discard;
    float alpha = clamp(mix(0.1, 0.75, vT) * vBright, 0.0, 1.0);
    alpha *= 1.0 - 0.8 * vHit; // blasted particles blend out
    gl_FragColor = vec4(vec3(0.85, 0.85, 0.83), alpha);
  }
`;

type ChildSpec = {
  positions: Float32Array;
  bright: Float32Array;
  flow: Float32Array;
  spin?: number; // rad/s in its own plane
  incline?: [number, number]; // rotation.x, rotation.z of the holder
};

const rand = (min: number, max: number) => min + Math.random() * (max - min);

function fibonacciSphere(count: number, radius: number): Float32Array {
  const pos = new Float32Array(count * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    pos[i * 3] = Math.cos(theta) * r * radius;
    pos[i * 3 + 1] = y * radius;
    pos[i * 3 + 2] = Math.sin(theta) * r * radius;
  }
  return pos;
}

function fillBright(count: number, min: number, max: number): Float32Array {
  const b = new Float32Array(count);
  for (let i = 0; i < count; i++) b[i] = rand(min, max);
  return b;
}

const noFlow = (count: number) => new Float32Array(count).fill(-1);

/* Pulse — a breathing sphere of particles */
function buildPulse(): ChildSpec[] {
  const COUNT = 2600;
  return [
    {
      positions: fibonacciSphere(COUNT, 1),
      bright: fillBright(COUNT, 0.4, 0.95),
      flow: noFlow(COUNT),
    },
  ];
}

/* Atlas — a globe with light travelling along great-circle arcs */
function buildGlobe(): ChildSpec[] {
  const SPHERE = 2200;
  const ARCS = 6;
  const ARC_PTS = 110;
  const total = SPHERE + ARCS * ARC_PTS;

  const positions = new Float32Array(total * 3);
  positions.set(fibonacciSphere(SPHERE, 1));
  const bright = new Float32Array(total);
  const flow = new Float32Array(total).fill(-1);
  for (let i = 0; i < SPHERE; i++) bright[i] = rand(0.3, 0.6);

  const randUnit = (): THREE.Vector3 => {
    const v = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1));
    return v.lengthSq() < 1e-4 ? randUnit() : v.normalize();
  };

  for (let a = 0; a < ARCS; a++) {
    let from = randUnit();
    let to = randUnit();
    // re-roll until the arc spans a satisfying chunk of the globe
    for (let tries = 0; tries < 20; tries++) {
      const angle = from.angleTo(to);
      if (angle > 0.9 && angle < 2.4) break;
      to = randUnit();
    }
    const angle = from.angleTo(to);
    for (let i = 0; i < ARC_PTS; i++) {
      const t = i / (ARC_PTS - 1);
      // slerp between the endpoints, floating just above the surface
      const p = new THREE.Vector3()
        .addScaledVector(from, Math.sin((1 - t) * angle))
        .addScaledVector(to, Math.sin(t * angle))
        .divideScalar(Math.sin(angle))
        .multiplyScalar(1.05);
      const idx = SPHERE + a * ARC_PTS + i;
      positions[idx * 3] = p.x;
      positions[idx * 3 + 1] = p.y;
      positions[idx * 3 + 2] = p.z;
      bright[idx] = 0.85;
      flow[idx] = t;
    }
  }

  return [{ positions, bright, flow }];
}

/* Orbit — a dense core with three inclined, spinning rings */
function buildRings(): ChildSpec[] {
  const core = (() => {
    const COUNT = 800;
    const positions = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      const v = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1));
      if (v.lengthSq() > 1) {
        i--;
        continue;
      }
      v.multiplyScalar(0.28);
      positions[i * 3] = v.x;
      positions[i * 3 + 1] = v.y;
      positions[i * 3 + 2] = v.z;
    }
    return {
      positions,
      bright: fillBright(COUNT, 0.5, 1),
      flow: noFlow(COUNT),
    };
  })();

  const ring = (
    radius: number,
    count: number,
    spin: number,
    incline: [number, number]
  ): ChildSpec => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const r = radius + rand(-0.025, 0.025);
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = rand(-0.015, 0.015);
      positions[i * 3 + 2] = Math.sin(a) * r;
    }
    return {
      positions,
      bright: fillBright(count, 0.35, 0.8),
      flow: noFlow(count),
      spin,
      incline,
    };
  };

  return [
    core,
    ring(0.6, 480, 0.5, [0.5, -0.25]),
    ring(0.85, 560, -0.32, [0.35, 0.4]),
    ring(1.1, 640, 0.22, [0.7, -0.1]),
  ];
}

/* MBUSI — a city street grid, tilted like a live transit map, with
   comets of light running along the bus routes */
function buildTransit(): ChildSpec[] {
  const EXTENT = 1.1;

  // irregularly spaced streets along each axis
  const streetCoords = (n: number) => {
    const arr: number[] = [];
    for (let i = 0; i < n; i++) {
      arr.push(-EXTENT + (i / (n - 1)) * 2 * EXTENT + rand(-0.05, 0.05));
    }
    arr[0] = -EXTENT;
    arr[n - 1] = EXTENT;
    return arr;
  };
  const vx = streetCoords(7); // north-south streets (x positions)
  const hz = streetCoords(7); // east-west streets (z positions)

  const pts: number[] = [];
  const bright: number[] = [];
  const flow: number[] = [];
  const push = (x: number, y: number, z: number, b: number, f = -1) => {
    pts.push(x, y, z);
    bright.push(b);
    flow.push(f);
  };

  // streets: dim particle lines on the ground plane
  const PER_LINE = 85;
  for (const x of vx) {
    for (let i = 0; i < PER_LINE; i++) {
      const z = -EXTENT + (i / (PER_LINE - 1)) * 2 * EXTENT;
      push(
        x + rand(-0.008, 0.008),
        rand(-0.005, 0.005),
        z + rand(-0.008, 0.008),
        rand(0.22, 0.45)
      );
    }
  }
  for (const z of hz) {
    for (let i = 0; i < PER_LINE; i++) {
      const x = -EXTENT + (i / (PER_LINE - 1)) * 2 * EXTENT;
      push(
        x + rand(-0.008, 0.008),
        rand(-0.005, 0.005),
        z + rand(-0.008, 0.008),
        rand(0.22, 0.45)
      );
    }
  }

  // buildings: faint particle columns rising from some blocks
  for (let bx = 0; bx < vx.length - 1; bx++) {
    for (let bz = 0; bz < hz.length - 1; bz++) {
      if (Math.random() < 0.45) continue;
      const w = vx[bx + 1] - vx[bx] - 0.1;
      const d = hz[bz + 1] - hz[bz] - 0.1;
      if (w < 0.05 || d < 0.05) continue;
      const cx = (vx[bx] + vx[bx + 1]) / 2;
      const cz = (hz[bz] + hz[bz + 1]) / 2;
      const h = rand(0.06, 0.26);
      const n = Math.floor(h * 190);
      for (let i = 0; i < n; i++) {
        push(
          cx + rand(-w / 2, w / 2),
          rand(0.01, h),
          cz + rand(-d / 2, d / 2),
          rand(0.1, 0.28)
        );
      }
    }
  }

  // bus routes: staircase paths following the streets; aFlow puts a
  // comet of light (the bus) on each one
  const ROUTE_PTS = 130;
  const addRoute = (phase: number) => {
    const waypoints: [number, number][] = [];
    let zi = Math.floor(rand(1, hz.length - 1));
    waypoints.push([-EXTENT, hz[zi]]);
    for (let xi = 1; xi < vx.length - 1; xi++) {
      if (Math.random() < 0.55) {
        const nzi = Math.max(
          0,
          Math.min(hz.length - 1, zi + (Math.random() < 0.5 ? -1 : 1))
        );
        if (nzi !== zi) {
          waypoints.push([vx[xi], hz[zi]]);
          zi = nzi;
          waypoints.push([vx[xi], hz[zi]]);
        }
      }
    }
    waypoints.push([EXTENT, hz[zi]]);

    const segs: { ax: number; az: number; bx: number; bz: number; len: number }[] = [];
    let total = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      const [ax, az] = waypoints[i];
      const [bx, bz] = waypoints[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      segs.push({ ax, az, bx, bz, len });
      total += len;
    }
    for (let i = 0; i < ROUTE_PTS; i++) {
      const t = i / (ROUTE_PTS - 1);
      let dist = t * total;
      let seg = segs[segs.length - 1];
      for (const s of segs) {
        if (dist <= s.len) {
          seg = s;
          break;
        }
        dist -= s.len;
      }
      const u = seg.len > 0 ? Math.min(dist / seg.len, 1) : 0;
      push(
        seg.ax + (seg.bx - seg.ax) * u,
        0.03,
        seg.az + (seg.bz - seg.az) * u,
        0.9,
        (t + phase) % 1
      );
    }
  };
  addRoute(0);
  addRoute(0.33);
  addRoute(0.66);

  return [
    {
      positions: new Float32Array(pts),
      bright: new Float32Array(bright),
      flow: new Float32Array(flow),
      spin: 0.14, // slow turntable in its own plane
      incline: [0.6, 0], // tipped up toward the camera
    },
  ];
}

/* Shopify — an invoice sheet: dashed text lines, a compliance check,
   and a pulse of light circling the border */
function buildInvoice(): ChildSpec[] {
  const W = 0.62; // half width
  const H = 0.82; // half height

  const pts: number[] = [];
  const bright: number[] = [];
  const flow: number[] = [];
  const push = (x: number, y: number, z: number, b: number, f = -1) => {
    pts.push(x, y, z);
    bright.push(b);
    flow.push(f);
  };
  const jz = () => rand(-0.02, 0.02);

  // border, parameterised so a comet can circle the sheet
  const corners: [number, number][] = [
    [-W, H],
    [W, H],
    [W, -H],
    [-W, -H],
  ];
  const segs = corners.map((c, i) => {
    const n = corners[(i + 1) % 4];
    return {
      ax: c[0],
      ay: c[1],
      bx: n[0],
      by: n[1],
      len: Math.hypot(n[0] - c[0], n[1] - c[1]),
    };
  });
  const perim = segs.reduce((s, g) => s + g.len, 0);
  const BORDER = 340;
  for (let i = 0; i < BORDER; i++) {
    const t = i / BORDER;
    let d = t * perim;
    let seg = segs[segs.length - 1];
    for (const s of segs) {
      if (d <= s.len) {
        seg = s;
        break;
      }
      d -= s.len;
    }
    const u = seg.len > 0 ? Math.min(d / seg.len, 1) : 0;
    push(
      seg.ax + (seg.bx - seg.ax) * u + rand(-0.005, 0.005),
      seg.ay + (seg.by - seg.ay) * u + rand(-0.005, 0.005),
      jz(),
      0.55,
      t
    );
  }

  // dashed rows of "text": broken segments read as words
  const textLine = (y: number, x0: number, x1: number, b: number) => {
    let x = x0;
    while (x < x1) {
      const word = Math.min(rand(0.08, 0.2), x1 - x);
      const n = Math.max(2, Math.floor(word / 0.015));
      for (let i = 0; i < n; i++) {
        push(
          x + (i / (n - 1)) * word,
          y + rand(-0.005, 0.005),
          jz(),
          b * rand(0.7, 1.1)
        );
      }
      x += word + rand(0.04, 0.09);
    }
  };
  textLine(0.6, -0.45, 0.1, 0.9); // header
  textLine(0.46, -0.45, -0.05, 0.45); // address block
  textLine(0.38, -0.45, -0.12, 0.45);
  for (let r = 0; r < 4; r++) textLine(0.16 - r * 0.14, -0.45, 0.45, 0.6); // items
  textLine(-0.52, 0.05, 0.45, 0.95); // total, bottom right

  // compliance mark: a circled tick, bottom left
  const cx = -0.32;
  const cy = -0.55;
  const r = 0.115;
  for (let i = 0; i < 70; i++) {
    const a = (i / 70) * Math.PI * 2;
    push(cx + Math.cos(a) * r, cy + Math.sin(a) * r, jz(), 0.8);
  }
  const tick: [number, number][] = [
    [-0.055, 0.005],
    [-0.012, -0.05],
    [0.06, 0.045],
  ];
  for (let s = 0; s < tick.length - 1; s++) {
    const [ax, ay] = tick[s];
    const [bx, by] = tick[s + 1];
    for (let i = 0; i <= 16; i++) {
      const u = i / 16;
      push(cx + ax + (bx - ax) * u, cy + ay + (by - ay) * u, jz(), 1.0);
    }
  }

  // faint paper grain
  for (let i = 0; i < 240; i++) {
    push(rand(-W, W), rand(-H, H), rand(-0.03, 0.03), rand(0.07, 0.16));
  }

  return [
    {
      positions: new Float32Array(pts),
      bright: new Float32Array(bright),
      flow: new Float32Array(flow),
    },
  ];
}

const BUILDERS: Record<ProjectVisualKind, () => ChildSpec[]> = {
  pulse: buildPulse,
  globe: buildGlobe,
  rings: buildRings,
  transit: buildTransit,
  invoice: buildInvoice,
};

// planar shapes sway instead of spinning — a full turn would show them edge-on
const SPINS_IDLE: Record<ProjectVisualKind, boolean> = {
  pulse: true,
  globe: true,
  rings: true,
  transit: false,
  invoice: false,
};

export default function ProjectVisual({ kind }: { kind: ProjectVisualKind }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current!;
    const canvas = canvasRef.current!;
    const reduceMotion = prefersReducedMotion();

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 4 / 3, 0.1, 50);
    camera.position.set(0, 0.3, 3.4);
    camera.lookAt(0, 0, 0);

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uAssemble: { value: reduceMotion ? 1 : 0 },
        uPixelRatio: { value: renderer.getPixelRatio() },
        uSwell: { value: kind === "pulse" ? 1 : 0 },
        uHit: { value: new THREE.Vector3() },
        uHitStrength: { value: 0 },
      },
      vertexShader,
      fragmentShader,
    });

    const group = new THREE.Group();
    scene.add(group);

    const spinners: { holder: THREE.Object3D; spin: number }[] = [];
    const geos: THREE.BufferGeometry[] = [];

    for (const spec of BUILDERS[kind]()) {
      const count = spec.positions.length / 3;
      const scatter = new Float32Array(count * 3);
      const randoms = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        // start as a loose shell around the shape
        const v = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1))
          .normalize()
          .multiplyScalar(rand(1.8, 2.9));
        scatter[i * 3] = v.x;
        scatter[i * 3 + 1] = v.y;
        scatter[i * 3 + 2] = v.z;
        randoms[i] = Math.random();
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(spec.positions, 3));
      geo.setAttribute("aScatter", new THREE.BufferAttribute(scatter, 3));
      geo.setAttribute("aRand", new THREE.BufferAttribute(randoms, 1));
      geo.setAttribute("aBright", new THREE.BufferAttribute(spec.bright, 1));
      geo.setAttribute("aFlow", new THREE.BufferAttribute(spec.flow, 1));
      geos.push(geo);

      const points = new THREE.Points(geo, mat);
      if (spec.incline || spec.spin) {
        const holder = new THREE.Group();
        if (spec.incline) holder.rotation.set(spec.incline[0], 0, spec.incline[1]);
        holder.add(points);
        group.add(holder);
        if (spec.spin) spinners.push({ holder: points, spin: spec.spin });
      } else {
        group.add(points);
      }
    }

    // ---------- sizing ----------
    const resize = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    // ---------- assemble on scroll, loosen when leaving ----------
    const assemble = { v: reduceMotion ? 1 : 0 };
    let trigger: ScrollTrigger | undefined;
    if (!reduceMotion) {
      trigger = ScrollTrigger.create({
        trigger: wrap,
        start: "top 88%",
        end: "bottom 12%",
        onToggle: (self) => {
          gsap.to(assemble, {
            v: self.isActive ? 1 : 0.2,
            duration: self.isActive ? 1.6 : 0.8,
            ease: "power2.inOut",
            overwrite: true,
          });
        },
      });
    }

    // ---------- cursor: subtle tilt + destructive blast ----------
    const tilt = { x: 0, y: 0, speed: 1 };
    const tiltX = gsap.quickTo(tilt, "x", { duration: 0.5, ease: "power2" });
    const tiltY = gsap.quickTo(tilt, "y", { duration: 0.5, ease: "power2" });

    const raycaster = new THREE.Raycaster();
    const bounds = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1.15);
    const hitTarget = new THREE.Vector3();
    const hitPoint = mat.uniforms.uHit.value as THREE.Vector3;
    const hit = { strength: 0 };
    const ndc = new THREE.Vector2();

    const onMove = (e: PointerEvent) => {
      const r = wrap.getBoundingClientRect();
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
      const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
      tiltX(ny * 0.12);
      tiltY(nx * 0.18);

      // project the cursor into the scene: hit the shape's bounding
      // sphere, or fall back to the nearest point on the ray
      ndc.set(nx, -ny);
      raycaster.setFromCamera(ndc, camera);
      if (!raycaster.ray.intersectSphere(bounds, hitTarget)) {
        raycaster.ray.closestPointToPoint(bounds.center, hitTarget);
      }
      if (hit.strength < 0.05) hitPoint.copy(hitTarget); // fresh entry: no streak
      // moving the cursor feeds the blast, decay in the render loop drains it
      hit.strength = Math.min(1.1, hit.strength + 0.22);
    };
    const onEnter = () => gsap.to(tilt, { speed: 1.8, duration: 0.8, ease: "power2.out" });
    const onLeave = () => {
      tiltX(0);
      tiltY(0);
      gsap.to(tilt, { speed: 1, duration: 0.8, ease: "power2.out" });
    };

    if (!reduceMotion) {
      wrap.addEventListener("pointermove", onMove);
      wrap.addEventListener("pointerenter", onEnter);
      wrap.addEventListener("pointerleave", onLeave);
    }

    // ---------- render loop, paused while off-screen ----------
    let visible = true;
    const io = new IntersectionObserver(
      ([entry]) => (visible = entry.isIntersecting),
      { rootMargin: "10%" }
    );
    io.observe(wrap);

    let last = performance.now();
    let elapsed = 0;
    let idleY = 0;
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (!visible) return;

      if (!reduceMotion) {
        elapsed += dt;
        mat.uniforms.uTime.value = elapsed;
        if (SPINS_IDLE[kind]) {
          idleY += dt * 0.22 * tilt.speed;
        } else {
          idleY = Math.sin(elapsed * 0.4) * 0.26;
        }
        for (const s of spinners) s.holder.rotation.y += dt * s.spin * tilt.speed;

        // the blast drains on its own; the hit point trails the cursor
        hit.strength *= Math.exp(-dt * 2.6);
        mat.uniforms.uHitStrength.value = hit.strength;
        hitPoint.lerp(hitTarget, 1 - Math.exp(-dt * 10));
      }
      mat.uniforms.uAssemble.value = assemble.v;
      group.rotation.set(0.15 + tilt.x, idleY + tilt.y, 0);
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      trigger?.kill();
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerenter", onEnter);
      wrap.removeEventListener("pointerleave", onLeave);
      geos.forEach((g) => g.dispose());
      mat.dispose();
      renderer.dispose();
    };
  }, [kind]);

  return (
    <div ref={wrapRef} className="project__visual">
      <div className="project__visual-bg" />
      <canvas ref={canvasRef} className="project__visual-canvas" />
    </div>
  );
}
