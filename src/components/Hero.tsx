"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { animate } from "animejs";
import { splitChars, prefersReducedMotion } from "@/lib/split";
import { profile } from "@/lib/data";

gsap.registerPlugin(ScrollTrigger);

const COLS = 220;
const ROWS = 220;
const SPACING = 0.14;
const MAX_CLICKS = 6;

const vertexShader = /* glsl */ `
  #define MAX_CLICKS ${MAX_CLICKS}

  uniform float uTime;
  uniform vec2  uMouse;
  uniform float uPixelRatio;
  uniform float uProgress; // 0 = full ocean, 1 = single flat line
  uniform float uScaleX;   // grid is stretched in x to fill the frustum
  uniform vec2  uClickPos[MAX_CLICKS];
  uniform float uClickTimes[MAX_CLICKS];
  varying float vHeight;

  void main() {
    vec3 p = position;

    // world-space xz, so wavelengths and ripples stay round despite the x stretch
    vec2 wpos = vec2(position.x * uScaleX, position.z);

    // depth collapses: the whole grid folds into one line along x
    float collapse = smoothstep(0.0, 0.85, uProgress);
    p.z = mix(p.z, 0.0, collapse);

    // the swell calms down as we collapse
    float amp = 0.35 * (1.0 - smoothstep(0.0, 0.7, uProgress));
    float wave1 = sin(wpos.x * 0.9 + uTime * 0.8);
    float wave2 = sin(wpos.y * 1.3 + uTime * 0.6 + wpos.x * 0.4);
    p.y = (wave1 + wave2) * amp;

    // mouse ripple, fading out with the collapse
    float d = distance(wpos, uMouse);
    p.y += sin(d * 3.0 - uTime * 4.0) * 0.4 * exp(-d * 0.6) * (1.0 - collapse);

    // click splashes: rings that expand outward and die down
    for (int i = 0; i < MAX_CLICKS; i++) {
      float t = uTime - uClickTimes[i];
      if (t < 0.0 || t > 4.0) continue;
      float cd = distance(wpos, uClickPos[i]);
      float ring = exp(-pow((cd - t * 3.2) * 1.6, 2.0));
      p.y += ring * 1.1 * exp(-t * 1.1) * (1.0 - collapse);
    }

    // once it's a line, a faint pulse keeps travelling along it
    p.y += sin(wpos.x * 2.0 + uTime * 1.5) * 0.06 * smoothstep(0.6, 1.0, uProgress);

    vHeight = p.y;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = 1.6 * uPixelRatio * (10.0 / -mv.z);
  }
`;

const fragmentShader = /* glsl */ `
  precision mediump float;
  uniform float uOpacity;
  varying float vHeight;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    if (length(uv) > 0.5) discard;
    float bright = 0.35 + smoothstep(-0.7, 0.9, vHeight) * 0.65;
    gl_FragColor = vec4(vec3(0.91, 0.91, 0.89), bright * uOpacity);
  }
`;

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const section = sectionRef.current!;
    const canvas = canvasRef.current!;
    const reduceMotion = prefersReducedMotion();

    // ---------- three.js scene ----------
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x0a0a0a, 1);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.set(0, 5.5, 11);

    const positions = new Float32Array(COLS * ROWS * 3);
    let i = 0;
    for (let x = 0; x < COLS; x++) {
      for (let z = 0; z < ROWS; z++) {
        positions[i++] = (x - COLS / 2) * SPACING;
        positions[i++] = 0;
        positions[i++] = (z - ROWS / 2) * SPACING;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const clickPos = Array.from(
      { length: MAX_CLICKS },
      () => new THREE.Vector2(999, 999)
    );
    const clickTimes = new Float32Array(MAX_CLICKS).fill(-1000);

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uMouse: { value: new THREE.Vector2(999, 999) },
        uPixelRatio: { value: renderer.getPixelRatio() },
        uProgress: { value: 0 },
        uOpacity: { value: 1 },
        uScaleX: { value: 1 },
        uClickPos: { value: clickPos },
        uClickTimes: { value: clickTimes },
      },
      vertexShader,
      fragmentShader,
    });

    const points = new THREE.Points(geo, mat);
    scene.add(points);

    // stretch the grid in x so its far edge fills the frustum on any aspect ratio
    const initialCamPos = camera.position.clone();
    const gridHalfWidth = (COLS / 2) * SPACING;
    const gridHalfDepth = (ROWS / 2) * SPACING;
    const fitWidth = () => {
      const dist = initialCamPos.distanceTo(
        new THREE.Vector3(0, 0, -gridHalfDepth)
      );
      const halfW =
        Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) *
        camera.aspect *
        dist;
      points.scale.x = Math.max(1, (halfW * 1.15) / gridHalfWidth);
      mat.uniforms.uScaleX.value = points.scale.x;
    };
    fitWidth();

    // mouse ripple: project cursor onto the y=0 plane
    const raycaster = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    const ndc = new THREE.Vector2();

    const pointerToPlane = (e: PointerEvent) => {
      ndc.set(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1
      );
      raycaster.setFromCamera(ndc, camera);
      return raycaster.ray.intersectPlane(plane, hit);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (pointerToPlane(e)) {
        mat.uniforms.uMouse.value.set(hit.x, hit.z);
      }
    };

    let clickIndex = 0;
    const onPointerDown = (e: PointerEvent) => {
      if (reduceMotion || state.progress > 0.1) return;
      if (pointerToPlane(e)) {
        clickPos[clickIndex].set(hit.x, hit.z);
        clickTimes[clickIndex] = (performance.now() - start) / 1000;
        clickIndex = (clickIndex + 1) % MAX_CLICKS;
      }
    };

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      mat.uniforms.uPixelRatio.value = renderer.getPixelRatio();
      fitWidth();
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", onResize);

    // values tweened by the scroll timeline, read every frame
    const state = { progress: 0, opacity: 1 };

    const start = performance.now();
    let raf = 0;
    const tick = () => {
      mat.uniforms.uTime.value = reduceMotion ? 0 : (performance.now() - start) / 1000;
      mat.uniforms.uProgress.value = state.progress;
      mat.uniforms.uOpacity.value = state.opacity;
      camera.lookAt(0, 0, 0);
      if (state.opacity > 0.001) renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    // ---------- gsap: intro + scroll choreography ----------
    const ctx = gsap.context(() => {
      const name = section.querySelector<HTMLElement>(".hero__name");
      const role = section.querySelector<HTMLElement>(".hero__role");
      if (!name || !role) return;
      const nameChars = splitChars(name);
      const roleChars = splitChars(role);

      if (reduceMotion) return;

      // entrance
      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .from(nameChars, { yPercent: 110, duration: 1, stagger: 0.035 }, 0.2)
        .from(roleChars, { yPercent: 110, duration: 0.8, stagger: 0.02 }, 0.55)
        .from(
          section.querySelectorAll("[data-load-fade]"),
          { autoAlpha: 0, y: 20, duration: 0.8, stagger: 0.12 },
          0.8
        );

      // scroll: text leaves → waves calm and fold into a line → line fades out
      gsap
        .timeline({
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: "+=2200",
            scrub: 1,
            pin: true,
            anticipatePin: 1,
          },
          defaults: { ease: "none" },
        })
        .to(".hero__content", { autoAlpha: 0, y: -90, duration: 0.3 }, 0)
        .to(".hero__hint", { autoAlpha: 0, duration: 0.15 }, 0)
        .to(state, { progress: 1, duration: 0.65 }, 0.05)
        .to(camera.position, { y: 1.1, z: 9.5, duration: 0.7 }, 0.05)
        .to(state, { opacity: 0, duration: 0.25 }, 0.75);
    }, section);

    // looping scroll hint, anime.js
    const hintLine = section.querySelector(".hero__hint-line");
    if (hintLine && !reduceMotion) {
      animate(hintLine, {
        scaleX: [0, 1, 0],
        duration: 2200,
        ease: "inOutQuad",
        loop: true,
      });
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", onResize);
      ctx.revert();
      geo.dispose();
      mat.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <header ref={sectionRef} className="hero" id="top">
      <canvas ref={canvasRef} className="hero__canvas" />

      <div className="hero__content">
        <p className="hero__eyebrow" data-load-fade>
          Hi, I&apos;m
        </p>
        <h1 className="hero__name">{profile.name}</h1>
        <h2 className="hero__role">{profile.role}</h2>
        <p className="hero__tagline" data-load-fade>
          I don&apos;t ship code I can&apos;t explain.
        </p>
        <div className="hero__cta" data-load-fade>
          <a className="btn btn--solid" href="#projects">
            View work
          </a>
          <a className="btn btn--ghost" href="#contact">
            Get in touch
          </a>
        </div>
      </div>

      <p className="hero__hint" data-load-fade>
        <span className="hero__hint-line" />
        Scroll — the ocean settles into a line
      </p>
    </header>
  );
}
