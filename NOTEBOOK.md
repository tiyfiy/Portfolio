# How this portfolio actually works — a field notebook

Written for a backend developer (Go/Python instincts) who wants to rebuild this from scratch next time. Read it top to bottom once, then use it as a reference. Order follows the dependency flow, not the alphabet.

---

## 0. The 30-second mental model

This is a **single-page** Next.js site. There is exactly one route (`/`). Next.js renders the static HTML skeleton on the server, ships it to the browser, then React "hydrates" it (attaches event listeners). After hydration, three animation libraries take over the visuals:

- **three.js** draws particles on `<canvas>` elements via the GPU (Hero ocean, project visuals)
- **GSAP** drives scroll-linked choreography and high-frequency cursor following
- **anime.js** handles small self-contained loops and elastic pop-ins

The architecture in one sentence: **React owns the DOM structure and state; the animation libraries own motion; `useEffect` is the airlock between the two worlds.**

Backend analogy: React is your declarative config layer (like Terraform — you describe desired state, it reconciles). The animation code is imperative side-effectful work that can't be expressed declaratively, so it's quarantined inside `useEffect` hooks with cleanup functions — the same role `defer` plays in Go: acquire in the body, release on the way out.

---

## 1. Map and reading order

```
portfolio/
├── next.config.ts          # Next.js config (empty — defaults)
├── tsconfig.json           # TS config; defines the "@/*" import alias → src/*
├── package.json            # deps: next, react, three, gsap, animejs
├── public/                 # static files served as-is (like Go's http.FileServer)
└── src/
    ├── app/                # Next.js "App Router" — file system IS the router
    │   ├── layout.tsx      # ① HTML shell: <html>, <body>, font, metadata
    │   ├── page.tsx        # ② the "/" route: assembles all sections
    │   └── globals.css     # ⑨ all styling; also carries animation setup states
    ├── lib/
    │   ├── data.ts         # ③ pure content: profile, skills, projects
    │   └── split.ts        # ④ DOM utility: splits text into char spans
    ├── hooks/
    │   └── useReveal.ts    # ⑤ shared scroll-reveal behavior (GSAP)
    └── components/
        ├── Nav.tsx         # ⑥ fixed navbar, scroll-aware background
        ├── Hero.tsx        # ⑦ THE big one: 3D particle ocean + scroll story
        ├── About.tsx       # ⑥ simplest section — the template for all sections
        ├── Skills.tsx      # ⑧ filterable pills: FLIP + magnetic cursor
        ├── Projects.tsx    # ⑥ maps data → cards
        ├── ProjectVisual.tsx # ⑧ second big one: per-project particle shapes
        ├── Contact.tsx     # ⑥ email wave + pulsing dot
        └── Footer.tsx      # trivial
```

**Study order** (circled numbers above): boot files → data → utilities → hook → simple components → Hero → Skills/ProjectVisual → CSS. Reason: every component depends on `data.ts`, `split.ts`, or `useReveal.ts`, so learn the dependencies first; the hard components only make sense once the shared primitives are obvious.

Dependency graph (arrows = imports):

```
layout.tsx → globals.css
page.tsx → Nav, Hero, About, Skills, Projects, Contact, Footer
Nav      → split.ts (reduced motion only)
Hero     → split.ts, data.ts, three, gsap, animejs
About    → useReveal
Skills   → useReveal, data.ts, gsap(Flip), animejs
Projects → useReveal, data.ts, ProjectVisual
ProjectVisual → data.ts (type only), three, gsap
Contact  → useReveal, split.ts, data.ts, animejs
Footer   → data.ts
useReveal → split.ts, gsap(ScrollTrigger)
```

Notice: `lib/` has zero imports from `components/`. Dependencies only point downward — same layering discipline as keeping your Go `internal/domain` package free of HTTP imports.

---

## 2. The toolchain (what runs before your code does)

### Next.js App Router

Next.js maps the file system to routes: `src/app/page.tsx` IS the handler for `GET /`. There's no router config file — the directory structure is the routing table. Think of it as a web framework where `mux.HandleFunc("/", ...)` is implied by file location.

`next.config.ts` here is an empty object — pure defaults. `tsconfig.json` matters for one thing you'll see everywhere:

```json
"paths": { "@/*": ["./src/*"] }
```

That's why imports say `@/lib/data` instead of `../../lib/data`. It's a compile-time alias, like a Go module path — nothing magic at runtime.

### Server components vs client components — the one Next.js concept you MUST get

By default, every component in `app/` is a **server component**: it runs on the server (or at build time), produces HTML, and **its JS is never shipped to the browser**. Server components cannot use `useState`, `useEffect`, refs, or event handlers — there's no browser there.

The escape hatch is the `"use client"` directive at the top of a file. It marks the file (and everything it imports) as a **client component**: rendered to HTML on the server too (for the initial paint), but its JS is also bundled, sent to the browser, and "hydrated" — React re-runs it client-side and wires up interactivity.

In this project:

- **Server components:** `layout.tsx`, `page.tsx`, `Footer.tsx` — pure structure, no interactivity.
- **Client components:** every other component — they all animate, so they all need `"use client"`.

Backend analogy: a server component is like a template rendered by `html/template` — string out, done. A client component is that template **plus** a sidecar program shipped to the client that takes over the rendered output.

**Gotcha:** `"use client"` doesn't mean "renders only in the browser." Client components still render once on the server to produce initial HTML. That's why `split.ts` guards with `typeof window !== "undefined"` — code at module top level or in render functions runs in Node too, where `window` doesn't exist. Only `useEffect` is guaranteed browser-only.

---

## 3. Boot sequence: `layout.tsx` → `page.tsx`

### `src/app/layout.tsx` (26 lines, mostly boilerplate)

```tsx
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = { title: "...", description: "..." };

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={geistSans.variable}>
      <body>{children}</body>
    </html>
  );
}
```

**What:** the outermost HTML shell. Every route's content arrives as `children`. With one route, this wraps `page.tsx`.

Three things happen here:

1. **Font loading.** `Geist(...)` runs at build time: Next.js downloads the font from Google, self-hosts it, and generates a CSS class that defines the CSS variable `--font-geist-sans`. `globals.css` then uses `font-family: var(--font-geist-sans), ...`. Zero runtime requests to Google, no flash of unstyled text.
2. **Metadata.** Exporting a `metadata` object makes Next.js emit `<title>` and `<meta name="description">`. Convention over configuration — you never write `<head>` by hand.
3. **CSS import.** `import "./globals.css"` is a bundler instruction ("include this stylesheet"), not a JS import. Webpack/Turbopack-ism.

**Why it exists:** Next.js requires a root layout. Remove it → build error. Its real job is "things that apply to every page": lang attribute, font, global CSS.

**General or specific:** 100% general. Every App Router project has this file in nearly this exact shape. Skim-level boilerplate.

### `src/app/page.tsx` (23 lines)

```tsx
export default function Home() {
  return (
    <>
      <Nav />
      <Hero />
      <main>
        <About /> <Skills /> <Projects /> <Contact />
      </main>
      <Footer />
    </>
  );
}
```

**What:** the `/` route. Pure composition — imports seven components, stacks them in order. No props, no state, no logic.

**Why so empty:** each section is self-sufficient. They pull their own content from `lib/data.ts` and manage their own animations internally. `page.tsx` is just the wiring diagram. If sections needed shared state (e.g., a global theme toggle), this is where it would live — the fact that it doesn't tells you the sections are fully decoupled.

**Details worth noticing:**

- `<>...</>` is a Fragment — React components must return one root node; Fragment groups children without adding a wrapper `<div>` to the DOM. (React's VDOM is a tree, not a forest.)
- `<Hero />` sits *outside* `<main>` because it's semantically a `<header>`; `Nav`/`Footer` likewise. Semantic HTML, good for accessibility and SEO.
- This file is a server component (no `"use client"`). It renders to HTML on the server; the client components inside it hydrate afterwards.

**Mental model recap:** `layout.tsx` is the HTML envelope, `page.tsx` is the table of contents. All real behavior lives one level down. In every Next.js project you read from now on, start at these two files — they tell you the page inventory in ten seconds.

---

## 4. The content layer: `src/lib/data.ts`

**What:** plain exported constants — `profile` (name, email, socials), `skills` (19 items, each with a `category`), `skillCategories` (the filter tabs), `projects` (3 items). Plus the types: `SkillCategory`, `Project`, `ProjectVisualKind`.

**Why:** separation of content from presentation. To change your email or add a project, you edit one file and never touch a component. It's a hardcoded database — the file even says "Placeholder content — edit this file." In a bigger site this would become a CMS or an API call; the components wouldn't care, because they already consume it as data.

Backend analogy: this is your seed data / fixtures file. Components are pure functions of it: `UI = f(data)`.

**Two TypeScript idioms worth internalizing:**

1. **Union types as enums:**
   ```ts
   export type SkillCategory = "frontend" | "backend" | "motion" | "tools";
   ```
   A string that can only be one of four literals. Like a Go const-enum but checked structurally at compile time, zero runtime cost. `ProjectVisualKind = "pulse" | "globe" | "rings"` works the same way and is the *contract* between data and rendering: each project names which 3D visual it wants, and `ProjectVisual.tsx` has a `BUILDERS` record keyed by exactly this type. Add a fourth kind to the union and the compiler forces you to add a builder — exhaustiveness via the type system.

2. **Widening a union locally:** `skillCategories` is typed `{ id: SkillCategory | "all"; ... }[]` — "all" is a UI concept (a filter tab), not a data concept (no skill is categorized "all"), so it's added only where the UI needs it. Small thing, good taste.

**General or specific:** the pattern (a `lib/data.ts` or `content/` directory) is extremely common in portfolio/marketing sites. The types-as-contract trick is universal TypeScript.

---

## 5. The text-splitting primitive: `src/lib/split.ts`

This 35-line file powers every "letters slide up into view" effect on the site. Understand it and half the animations become obvious.

### `splitChars(el)`

**What it does, plainly:** takes an element containing text like `Timotej Maučec` and rebuilds its DOM into:

```html
<span class="word" aria-hidden="true">
  <span class="char">T</span><span class="char">i</span>...
</span>
" "
<span class="word">...</span>
```

returning the flat array of `.char` elements so an animation library can move each one individually.

**Why words wrap chars:** two reasons, both important.

1. **The mask effect.** `globals.css` gives `.word` `overflow: hidden`. So when GSAP sets each `.char` to `yPercent: 110` (pushed below its own height), the chars are *clipped invisible* by their word container. Animating `yPercent → 0` makes letters rise out of an invisible slot. The "mask" is just overflow clipping — no SVG, no clip-path. This is the single most-used trick in high-end text animation.
2. **Line wrapping.** `.word` is `display: inline-block`, so the browser still wraps text at word boundaries. If you wrapped only chars, a line could break mid-word.

**The accessibility move:** the original text is saved to `aria-label` on the parent, and each `.word` gets `aria-hidden="true"`. Screen readers announce "Timotej Maučec", not "T. i. m. o...". Whenever you shred DOM for visual effect, restore meaning through ARIA.

**The comment about strict mode:** in development, React 18+ mounts components twice (intentionally — to surface effects that aren't idempotent). `splitChars` reads `el.textContent` first — and a split element's `textContent` is still the original characters (spans don't change text content) — so running it twice rebuilds the same structure instead of double-wrapping. Idempotency by construction, the same property you want in a message-queue consumer.

### `prefersReducedMotion()`

```ts
typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
```

Reads an OS-level accessibility setting ("reduce motion" in macOS/Windows/iOS settings). **Every animated component in this project checks it first** and either skips animation entirely or jumps straight to the end state. The `typeof window` guard makes it safe during server rendering (returns false on the server).

**General or specific:** both utilities are general patterns. Libraries exist for splitting (GSAP's own SplitText is paid-tier), but a hand-rolled splitter is common and this one is a clean reference implementation.

**Gotcha to remember:** `splitChars` destroys child elements. It's only safe on elements containing pure text. Run it on something with a nested `<a>` and the link is gone.

---

## 6. The shared reveal system: `src/hooks/useReveal.ts`

**What, plainly:** every content section (About, Skills, Projects, Contact) has the same two scroll behaviors — titles whose letters rise out of a mask, and blocks that fade up — triggered when the element scrolls into view. This hook implements both, once.

```ts
export function useReveal(scope: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = scope.current;
    if (!root || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      root.querySelectorAll("[data-split-scroll]").forEach((el) => {
        const chars = splitChars(el);
        gsap.from(chars, { yPercent: 110, ..., scrollTrigger: { trigger: el, start: "top 85%", once: true } });
      });
      root.querySelectorAll("[data-reveal]").forEach((el) => {
        gsap.from(el, { y: 44, autoAlpha: 0, ..., scrollTrigger: { trigger: el, start: "top 88%", once: true } });
      });
    }, root);
    return () => ctx.revert();
  }, [scope]);
}
```

### The opt-in mechanism: data attributes

A component using the hook just tags elements:

```tsx
<h2 className="section__title" data-split-scroll>About</h2>
<p data-reveal>...</p>
```

The hook scans the section for those attributes and wires animations. This is **markup-driven configuration**: the JSX declares *what* should reveal; the hook owns *how*. Adding a revealed paragraph = adding one attribute. Compare to the alternative — every section importing gsap and repeating 20 lines of trigger setup. Analogy: struct tags in Go (`json:"name"`) — declarative annotations consumed by shared machinery.

### Piece by piece

- **Custom hook** = plain function calling other hooks. Pure code reuse, like extracting shared handler middleware. The `use` prefix is a linter convention that lets React enforce the Rules of Hooks.
- **`scope` ref:** each section passes a ref to its root element so queries are scoped (`root.querySelectorAll`), not global. Two sections never fight over each other's elements.
- **`gsap.context(fn, root)`** collects every animation/ScrollTrigger created inside `fn` so `ctx.revert()` can undo all of them at once — kill triggers, restore inline styles. It's GSAP's transaction object. Returned from `useEffect` as the cleanup function, it runs on unmount (and on strict-mode's double-mount, which is exactly why it must exist).
- **`gsap.from(el, {...})`:** animate *from* these values *to* the element's natural state. The element's CSS is the destination; the animation defines the origin. (vs `gsap.to` which is the opposite.)
- **`autoAlpha`:** GSAP shorthand for `opacity` + `visibility: hidden` at 0. Hidden elements don't intercept clicks while invisible.
- **`scrollTrigger: { trigger: el, start: "top 85%", once: true }`:** fire when the element's top edge reaches 85% down the viewport; play once and self-destroy. ScrollTrigger is GSAP's plugin tying animation to scroll position — registered at module load with `gsap.registerPlugin(ScrollTrigger)` (an explicit side-effect import, needed because tree-shaking bundlers would otherwise drop the plugin).

### A subtlety: the FOUC trade-off

`gsap.from(..., autoAlpha: 0)` means the element is visible until JS runs, then hidden, then revealed by scroll. On slow connections content can flash before hiding. Common production fix: a CSS class hides elements initially and JS removes it (or sets initial state inline). This project accepts the trade-off for simplicity — worth knowing the failure mode.

**General or specific:** custom hook + `gsap.context` + cleanup is THE canonical React-GSAP integration (it's what GSAP's own `useGSAP` hook packages). Data-attribute opt-in is a stylistic choice, but a popular one.

**Mental model recap:** `useReveal` is shared middleware for sections. Section = `ref` + `useReveal(ref)` + sprinkle `data-reveal`/`data-split-scroll` attributes. Everything else is automatic, including cleanup.

---

## 7. The React ↔ animation contract (read this before any component)

Every animated component here follows the same skeleton. Learn it once:

```tsx
"use client";                              // ① runs in the browser
export default function Section() {
  const ref = useRef<HTMLElement>(null);   // ② handle to a real DOM node
  useEffect(() => {                        // ③ after mount, browser only
    const el = ref.current!;
    if (prefersReducedMotion()) { /* set end state */ return; }
    // ... create animations, add listeners ...
    return () => { /* ④ kill everything you created */ };
  }, []);                                  // ⑤ run once per mount
  return <section ref={ref}>...</section>;
}
```

Why each piece is non-negotiable:

- **`useRef`** is how you get from React's virtual world to an actual DOM node. GSAP/three.js/anime.js mutate real elements; they can't operate on JSX. A ref is a stable pointer that survives re-renders (like a struct field, vs. local variables which are "stack" — recreated each render).
- **`useEffect` with `[]`** runs after the component is in the DOM, exactly once per mount (twice in dev strict mode — hence cleanup discipline). It's the only place where `window`, `document`, and refs are guaranteed available.
- **The cleanup return** is `defer` for components. Without it: duplicated animations in dev, leaked `requestAnimationFrame` loops, dangling window listeners after navigation, GPU memory leaks from undisposed three.js objects.
- **The reduced-motion early return** at the top of every effect.

One more recurring split worth naming — **two kinds of mutable state**:

- `useState` → state that should change *what's rendered* (Nav's `scrolled` flag, Skills' `filter`). Setting it re-runs the component function.
- `useRef` / plain objects → state that animations read 60×/second but that should NOT re-render anything (Hero's `state.progress`, Skills' `enteredRef`). Re-rendering React on every frame would be like re-running your whole request handler on every byte received.

Choosing wrongly in either direction is the classic React-animation bug: jank (too many renders) or stale UI (state in a ref that the JSX needed).

---

## 8. `Nav.tsx` — small, but two patterns in 40 lines

**What:** fixed navbar. Fades in 1.4s after load (politely after the hero text). Gains a blurred dark background once you scroll past 40px.

Pattern 1 — **CSS sets the hidden state, JS animates to visible:**

```css
.nav { opacity: 0; }            /* in globals.css */
```
```ts
gsap.to(nav, { opacity: 1, y: 0, duration: 1, delay: 1.4 });
```

Because the *hidden* state lives in CSS, there's no flash of the nav before JS loads (the inverse of the `useReveal` FOUC trade-off — this is the more defensive variant). Note the reduced-motion branch must then explicitly `gsap.set(nav, { opacity: 1 })` or the nav would stay invisible forever. That's the cost of this pattern: every code path must end at opacity 1.

Pattern 2 — **scroll state via `useState`:**

```ts
const onScroll = () => setScrolled(window.scrollY > 40);
window.addEventListener("scroll", onScroll, { passive: true });
```

`scrolled` is real render state — it toggles the `nav--scrolled` class in JSX, and CSS transitions the background/blur. `{ passive: true }` tells the browser the handler won't call `preventDefault()`, so scrolling never waits on JS. Note `onScroll()` is also called once immediately — covers loading the page already mid-scroll (e.g., after a refresh).

Why setState here and a ref in Hero? Because this value changes *rarely* (crossing the 40px line) and *should* re-render. State that changes every frame goes in refs; state that changes the UI on discrete events goes in `useState`. Same rule as section 7.

**General or specific:** both patterns are universal. This is a great minimal file to copy as a template.

---

## 9. `Hero.tsx` — the centerpiece (253 lines)

**What, plainly:** a full-viewport 3D ocean of ~48,400 points that ripples under the cursor. Your name slides in letter by letter. When you scroll, the section pins in place while the text flies up, the ocean calms and folds into a single horizontal line, the line pulses, then fades — and only then does the page continue. Three systems cooperate: a three.js scene, a GSAP scroll timeline, and one anime.js loop.

### 9.1 The three.js scene (CPU side)

Boilerplate trio — every three.js app has these:

```ts
renderer = new THREE.WebGLRenderer({ canvas });  // talks to the GPU
scene    = new THREE.Scene();                    // object container
camera   = new THREE.PerspectiveCamera(50, aspect, 0.1, 100);
camera.position.set(0, 5.5, 11);                 // above and back → looking down at the water
```

`renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))` caps resolution on 3×+ phone screens — pure perf guard, you'll see it everywhere.

The geometry is built by hand:

```ts
const positions = new Float32Array(COLS * ROWS * 3);   // 220×220 points × xyz
// fill a flat grid on the XZ plane, centered at origin, y = 0
geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
```

A `Float32Array` of raw coordinates — this is the actual memory layout uploaded to the GPU, like building a binary protocol buffer by hand. `THREE.Points` renders one dot per vertex instead of triangles.

**Key insight: the grid is flat and never changes on the CPU.** All wave motion happens on the GPU. The CPU never touches 48k points per frame — it just updates a handful of uniform floats. That's why this is cheap.

### 9.2 The vertex shader (GPU side) — where the ocean lives

A shader is a tiny C-like program (GLSL) compiled onto the GPU. The **vertex shader** runs *once per point, every frame, in parallel* — 48,400 simultaneous executions. Inputs: per-vertex `attributes` (position) and global `uniforms` (uTime, uMouse, uProgress, uPixelRatio). Uniforms are the CPU→GPU message channel: JS writes `mat.uniforms.uTime.value = ...`, shader reads `uTime`. Like shared memory between two processes — CPU writes a few floats, GPU does the heavy parallel loop.

Walk through, line by line, in pipeline order:

```glsl
float collapse = smoothstep(0.0, 0.85, uProgress);
p.z = mix(p.z, 0.0, collapse);
```
`uProgress` is the scroll progress (0→1, driven by GSAP). `mix(a,b,t)` is lerp. As you scroll, every point's z slides toward 0 — the 2D grid flattens into a 1D line along x. `smoothstep` is an easing ramp (0 below edge0, 1 above edge1, smooth S-curve between) — used everywhere in shaders to convert a linear driver into a styled transition. Remap + ease, the shader idiom.

```glsl
float amp = 0.35 * (1.0 - smoothstep(0.0, 0.7, uProgress));
float wave1 = sin(position.x * 0.9 + uTime * 0.8);
float wave2 = sin(position.z * 1.3 + uTime * 0.6 + position.x * 0.4);
p.y = (wave1 + wave2) * amp;
```
The ocean: two sine waves with different frequencies/directions summed. One sine looks fake; two with offset phases look like water. `amp` shrinks as scroll progresses — the swell calms *before* the fold completes (note the staggered smoothstep windows: amplitude dies over 0→0.7, depth collapses over 0→0.85 — that ordering is the choreography).

```glsl
float d = distance(position.xz, uMouse);
p.y += sin(d * 3.0 - uTime * 4.0) * 0.4 * exp(-d * 0.6) * (1.0 - collapse);
```
The cursor ripple: a sine wave radiating outward in distance-space (`sin(d*k - t*ω)` = expanding circular wave, classic), damped by `exp(-d * 0.6)` so it dies off with distance — exponential falloff is THE standard "local influence" function. Multiplied by `(1.0 - collapse)` so ripples fade as the ocean folds.

```glsl
p.y += sin(position.x * 2.0 + uTime * 1.5) * 0.06 * smoothstep(0.6, 1.0, uProgress);
```
Once mostly collapsed (progress > 0.6), a faint pulse travels along the final line. Detail polish.

```glsl
vHeight = p.y;
gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
gl_PointSize = 1.6 * uPixelRatio * (10.0 / -mv.z);
```
`vHeight` is a *varying* — a per-vertex value passed to the fragment shader (used there to make wave crests brighter). The matrix line is the standard world→camera→screen projection, memorize-don't-derive. `gl_PointSize` ∝ `1/-mv.z` makes distant points smaller (manual perspective for point sprites; `-mv.z` is distance in front of the camera).

The **fragment shader** runs per pixel of each point sprite:

```glsl
vec2 uv = gl_PointCoord - 0.5;
if (length(uv) > 0.5) discard;        // square sprite → circular dot
float bright = 0.35 + smoothstep(-0.7, 0.9, vHeight) * 0.65;
gl_FragColor = vec4(vec3(0.91, 0.91, 0.89), bright * uOpacity);
```
`discard` throws away corner pixels — that's how you get round particles. Height→brightness means crests glow: cheap fake lighting.

### 9.3 Mouse → world space: the raycaster

The shader needs the cursor position *in ocean coordinates*, not pixels:

```ts
ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
raycaster.setFromCamera(ndc, camera);
raycaster.ray.intersectPlane(plane, hit);   // plane = y=0, the water surface
mat.uniforms.uMouse.value.set(hit.x, hit.z);
```

Pixels → NDC (normalized device coordinates, -1..1 both axes, y flipped because screen y grows downward) → a ray from the camera through that screen point → intersect with the infinite y=0 plane → world-space point under the cursor. This unproject-then-intersect dance is the standard recipe for any "mouse interacts with 3D scene" feature. Memorize the shape of it.

### 9.4 The render loop and the `state` object — the GSAP↔three bridge

```ts
const state = { progress: 0, opacity: 1 };   // plain JS object!

const tick = () => {
  mat.uniforms.uTime.value = (performance.now() - start) / 1000;
  mat.uniforms.uProgress.value = state.progress;   // copy JS → GPU
  mat.uniforms.uOpacity.value  = state.opacity;
  if (state.opacity > 0.001) renderer.render(scene, camera);  // skip when invisible
  raf = requestAnimationFrame(tick);
};
```

This is the elegant trick of the whole file: **GSAP can tween any numeric property of any object** — not just DOM. The scroll timeline tweens `state.progress` on a plain object; the render loop copies it into a uniform each frame. `state` is a mailbox between the scroll system and the GPU. No coupling: GSAP knows nothing about three.js, three.js knows nothing about scrolling.

Also note the early-out: when the ocean has fully faded (`opacity ≤ 0.001`), `renderer.render` is skipped — no GPU work while you read the rest of the page, even though the rAF loop keeps idling (cheap).

### 9.5 The two GSAP timelines

**Entrance** (plays once on load):

```ts
gsap.timeline({ defaults: { ease: "power3.out" } })
  .from(nameChars, { yPercent: 110, duration: 1, stagger: 0.035 }, 0.2)
  .from(roleChars, { yPercent: 110, duration: 0.8, stagger: 0.02 }, 0.55)
  .from("[data-load-fade]", { autoAlpha: 0, y: 20, stagger: 0.12 }, 0.8);
```

A timeline is a sequencer. The trailing numbers (0.2, 0.55, 0.8) are absolute start times — the role starts while the name is still finishing. **Overlap is what makes choreography feel designed instead of queued.** `stagger: 0.035` = each char starts 35ms after the previous → the cascade. Chars use the `splitChars` + `overflow:hidden` mask from section 5.

**Scroll choreography** (the pinned story):

```ts
gsap.timeline({
  scrollTrigger: {
    trigger: section, start: "top top", end: "+=2200",
    scrub: 1, pin: true, anticipatePin: 1,
  },
  defaults: { ease: "none" },
})
  .to(".hero__content", { autoAlpha: 0, y: -90, duration: 0.3 }, 0)
  .to(".hero__hint",    { autoAlpha: 0, duration: 0.15 }, 0)
  .to(state,            { progress: 1, duration: 0.65 }, 0.05)
  .to(camera.position,  { y: 1.1, z: 9.5, duration: 0.7 }, 0.05)
  .to(state,            { opacity: 0, duration: 0.25 }, 0.75);
```

The three concepts that change everything:

- **`pin: true`** — the hero is frozen on screen while you scroll through 2200 virtual pixels (`end: "+=2200"`). ScrollTrigger inserts a spacer element so the page still has scroll room. The scroll wheel stops moving the page and starts moving the *story*.
- **`scrub: 1`** — the timeline's playhead is *bound to scroll position* instead of the clock. Scroll halfway = timeline at 50%. Scroll up = timeline plays backward. The `1` adds one second of smoothing/lag so wheel steps don't stutter. With scrub, "duration" values stop meaning seconds and become **proportions of the scroll distance**, and `ease: "none"` is the right default (your finger is the easing).
- **Tween targets are heterogeneous:** DOM (`.hero__content`), a plain object (`state` → shader), and `camera.position` (a three.js Vector3) all sequenced in one timeline. GSAP as universal property-tweener is the unifying idea.

Read the choreography off the position/duration numbers (timeline runs 0→1 over the pin): text exits during 0–0.3; ocean folds during 0.05–0.7 while the camera descends to line level (y 5.5→1.1 — that's why the line ends up edge-on, a perfect horizon); everything fades during 0.75–1.0.

**`anticipatePin: 1`** — pre-applies the pin a frame early to avoid a visible jump on fast scrolls. Pure gotcha-fix flag.

### 9.6 anime.js cameo + cleanup

The scroll-hint line loops forever via anime.js (`scaleX: [0, 1, 0], loop: true`) — anime's array-keyframe syntax is more compact than a GSAP timeline for tiny loops. That's the rationale for the third library: gsap for choreography, anime for self-contained loops.

Cleanup (the return) is the full checklist: `cancelAnimationFrame`, remove both window listeners, `ctx.revert()` (kills both timelines + ScrollTrigger + restores text), `geo.dispose()`, `mat.dispose()`, `renderer.dispose()` (GPU memory is NOT garbage-collected — dispose or leak).

**General or specific:** scene boilerplate, raycaster recipe, scrub/pin, uniform bridge — all general patterns you'll reuse. The specific shader math (two sines + exp falloff) is this project's art direction, but the *structure* (driver uniform + smoothstep remaps) is how virtually all scroll-driven shaders are written.

**Mental model recap:** Hero = three systems with one narrow interface. GPU owns per-point motion (shader reading uniforms), GSAP owns time/scroll (writing to a plain `state` object and `camera.position`), the rAF loop ferries `state` into uniforms. Scroll choreography = pinned section + scrubbed timeline + everything keyed to one progress value.

---

## 10. `About.tsx` — the section template (skim)

38 lines, zero original logic. Its value is as the **canonical section recipe**:

```tsx
const ref = useRef<HTMLElement>(null);
useReveal(ref);
return (
  <section ref={ref} className="section about" id="about">
    <p className="section__index" data-reveal>01</p>
    <h2 className="section__title" data-split-scroll>About</h2>
    ...content with data-reveal sprinkled on...
  </section>
);
```

The `id="about"` is what `<a href="#about">` in the nav targets; `html { scroll-behavior: smooth }` in CSS makes the jump glide. That's the whole navigation system — no router, no JS scrolling library. Every other section (Skills, Projects, Contact) is this skeleton plus its own extras.

---

## 11. `Skills.tsx` — the state-coordination puzzle (193 lines)

**What, plainly:** 19 pill-shaped tags. They pop in elastically when scrolled into view. They lean toward your cursor like magnets. Tabs filter them: matching pills sort to the front and dimmed ones fade, with every pill *gliding* to its new grid position. Three animation systems on the same elements — the interesting part is how they're kept from fighting.

### 11.1 Entrance (anime.js inside a ScrollTrigger)

`ScrollTrigger.create({ once: true, onEnter })` → anime.js animates pills `opacity 0→1, translateY 22→0, scale 0.7→1` with `ease: "outElastic(1, .7)"` and `delay: stagger(45)`. anime.js is chosen here for its springy elastic ease.

The crucial part is the **handoff in `onComplete`:**

```ts
markEntered();                       // entered=true → JSX adds .skill--in class
pills.forEach((p) => { p.style.opacity = ""; p.style.transform = ""; });
```

anime.js animates via inline styles. Inline styles override classes and would corrupt every later GSAP transform. So when the entrance finishes: a CSS class takes over visibility (`.skill--in { opacity: 1 }` — pills start at `opacity: 0` in the stylesheet, the defensive no-FOUC pattern from Nav), and the inline styles are wiped so the element is "clean" for GSAP. **When two systems animate one element, define explicit ownership handoffs.** This is the file's deepest lesson.

Note the *pair* `entered` (useState — drives the class in JSX) and `enteredRef` (useRef — read inside the pointermove handler). Why both? The event handler was created once in an effect with `[]`; it closes over the *first render's* `entered` value forever (a stale closure — the JS equivalent of capturing a loop variable in a goroutine). The ref is a stable pointer whose `.current` is always fresh. Rule: **callbacks created once read refs, JSX reads state.**

### 11.2 The magnet (GSAP `quickTo`)

```ts
toX: gsap.quickTo(el, "x", { duration: 0.4, ease: "power3" })
```

`quickTo` pre-compiles a tween for one property — a prepared statement vs. building the query each call. On every pointermove: distance from cursor to each pill's center; if < 120px, pull toward cursor proportional to closeness (`(1 - d/R) * 0.32`); else ease back to 0. Each call *retargets* the easing tween, so motion stays smooth (springy follow, not teleport).

The subtle bug it avoids:

```ts
const cx = r.left + r.width / 2 - Number(gsap.getProperty(m.el, "x"));
```

`getBoundingClientRect()` measures where the pill *currently is* — including the magnet offset already applied. Compute distance from that and the reference point drifts with the pill (feedback loop → pills fly away). Subtracting the current GSAP `x`/`y` recovers the **resting** center. When animation offsets and measurement mix, always normalize back to the rest frame.

Guard clauses: the handler bails while `!enteredRef.current` (don't fight the entrance) and while `flippingRef.current` (don't fight the FLIP). Plain refs as cross-system mutex flags.

### 11.3 Filtering with FLIP

The sort itself is plain derived data, recomputed in render — no second state:

```ts
const sorted = filter === "all" ? skills
  : [...skills].sort((a, b) => Number(isMatch(b.category)) - Number(isMatch(a.category)));
```

(Matches sort before non-matches; non-matches keep rendering but get `.skill--dim` → opacity 0.22 via CSS. Nothing unmounts — that's what makes position animation possible. Also note `key={s.name}`: stable keys are what let React *move* DOM nodes instead of destroying/recreating them. With index keys, FLIP would have nothing to track.)

Animating the reorder is **FLIP** — First, Last, Invert, Play. You can't animate "element moved because its flex-order changed"; there's no CSS transition for layout position. FLIP fakes it: record old positions (First), let the change happen instantly (Last), transform elements back to where they were (Invert), animate transforms to zero (Play). Measure → mutate → measure → animate.

Its implementation is split across the React render cycle:

```ts
const onTab = (next) => {
  flipState.current = Flip.getState(grid.querySelectorAll(".skill"));  // FIRST (before)
  setFilter(next);                                                     // triggers re-render
};

useLayoutEffect(() => {              // runs after DOM mutation, BEFORE paint
  const state = flipState.current;
  if (!state) return;                // skip non-filter renders
  flipState.current = null;
  gsap.set(pills, { x: 0, y: 0 });   // cancel magnet offsets first!
  Flip.from(state, { duration: 0.75, ease: "power3.inOut", stagger: 0.012, ... });
}, [filter]);
```

Why **`useLayoutEffect`** and not `useEffect`: it runs synchronously after React updates the DOM but *before the browser paints*. The Invert step must apply in that gap — with `useEffect` (async, after paint) you'd see one frame of pills teleported to new positions before they snap back and glide. This is *the* canonical legitimate use of `useLayoutEffect`.

Why `gsap.set(pills, {x:0, y:0})` first: pills may carry magnet offsets at click time; FLIP's final positions assume clean transforms. Zero them or pills land off-grid. Another system-handoff move.

The full lifecycle of one tab click: snapshot → setFilter → React re-sorts and re-renders (moving DOM nodes via keys) → layout effect inverts+plays before paint → `flippingRef` blocks the magnet until `onComplete`.

**General or specific:** FLIP, stale-closure refs, quickTo, ownership handoffs — all general, transferable techniques. The magnet constants and elastic entrance are taste.

**Mental model recap:** Skills is three animation systems sharing 19 elements without collisions, coordinated by two boolean flags (`enteredRef`, `flippingRef`) and explicit style-ownership handoffs. The filter is ordinary React state + derived sort; FLIP makes the reorder visible; `useLayoutEffect` is what makes FLIP possible in React.

---

## 12. `Projects.tsx` — data → UI mapping (skim)

The standard section skeleton (ref + `useReveal` + data attributes) plus the most idiomatic React pattern there is:

```tsx
{projects.map((project) => (
  <article key={project.title} className="project" data-reveal>
    <ProjectVisual kind={project.visual} />
    ...title, description, tags.map(...), link...
  </article>
))}
```

A `for` loop over rows rendering a template — `range` over query results. `key` gives React a stable identity per item (use a real ID, not array index, whenever the list can reorder). The one line with architectural weight is `<ProjectVisual kind={project.visual} />`: the data's `visual: "pulse" | "globe" | "rings"` string selects which 3D scene gets built. Content decides, component dispatches.

The alternating left/right layout is **pure CSS**, not JSX logic: `.project:nth-child(even) .project__visual { order: 2 }`. Presentation concerns stay in the stylesheet.

---

## 13. `ProjectVisual.tsx` — the particle factory (443 lines)

**What, plainly:** each project card has a canvas with ~2,500–3,000 particles forming a shape — a breathing sphere (Pulse), a globe with comets traveling along arcs (Atlas), or a core with three spinning rings (Orbit). Scroll a card into view and scattered particles *assemble* into the shape; scroll away and they loosen. Hovering tilts the shape and the cursor *blasts* particles aside, which heal back.

It's Hero's architecture again (scene + custom shader + uniforms + rAF), so this section covers only what's NEW.

### 13.1 One shader, three shapes — data-driven geometry

The shader and material logic are shared; only vertex data differs. Each shape is described by a `ChildSpec`: `positions` (where particles sit when assembled), `bright` (per-particle base brightness), `flow` (0–1 position along an arc, or -1 = not on an arc), optional `spin`/`incline` for rings. Builders produce specs:

```ts
const BUILDERS: Record<ProjectVisualKind, () => ChildSpec[]> = {
  pulse: buildPulse, globe: buildGlobe, rings: buildRings,
};
```

A dispatch table keyed by the union type from `data.ts` — `map[string]func()` with compile-time exhaustiveness. Adding a visual = write a builder, add a union member, name it in data. Nothing else changes. This is the file's architectural idea: **shapes are data, not code paths.**

Builder math worth stealing:

- **`fibonacciSphere`** — distribute n points evenly on a sphere using the golden angle. *The* standard recipe; naive random lat/long clumps at the poles.
- **Globe arcs** — **slerp** (spherical lerp) between two random unit vectors: `(sin((1-t)·θ)·A + sin(t·θ)·B) / sin(θ)`, pushed to radius 1.05 so arcs float above the surface. Endpoints are re-rolled until the angle is "satisfying" (0.9–2.4 rad) — generative art always has these curation loops.
- **Rings core: rejection sampling** — random points in the unit cube, discard those outside the unit sphere (`if (v.lengthSq() > 1) { i--; continue; }`). Naive `random direction × random radius` would clump at the center; rejection gives uniform density.

### 13.2 The assemble effect

Every particle gets two homes: `position` (its place in the shape) and `aScatter` (a random point on a loose shell, radius 1.8–2.9). The vertex shader interpolates:

```glsl
float t = smoothstep(aRand * 0.5, aRand * 0.5 + 0.5, uAssemble);
vec3 p = mix(aScatter, position, t);
```

The trick: each particle has its own random `aRand`, which offsets its smoothstep *window*. As the single `uAssemble` uniform sweeps 0→1, particles with low `aRand` finish early, high ones start late — **per-particle stagger computed on the GPU from one scalar driver.** The CPU animates exactly one number:

```ts
ScrollTrigger.create({ trigger: wrap, start: "top 88%", end: "bottom 12%",
  onToggle: (self) => gsap.to(assemble, { v: self.isActive ? 1 : 0.2, ... }) });
```

`onToggle` (not `once: true` like useReveal): assembly is *reversible* — leave the viewport and the shape loosens to 0.2 (not 0 — still ghostly present). `overwrite: true` kills any in-flight tween when you scroll back quickly, preventing tween pile-up.

Other shader niceties: per-particle "breathing" jitter from `sin/cos(uTime · k + aRand · prime)` (primes decorrelate the phases); the heartbeat `uSwell` only nonzero for the pulse variant; the comet on arcs — `fract(aFlow - uTime * 0.1)` makes a brightness peak chase around each arc forever (`fract` = wraparound, i.e. modulo-1 time).

### 13.3 The cursor blast — a tiny physics fake

On pointermove, the cursor ray is intersected with a bounding *sphere* around the shape (fallback: nearest point on the ray) → `uHit` world point. Energy model, split across CPU and GPU:

```ts
// CPU, pointermove: moving feeds energy
hit.strength = Math.min(1.1, hit.strength + 0.22);
// CPU, render loop: energy drains exponentially, hit point trails the cursor
hit.strength *= Math.exp(-dt * 2.6);
hitPoint.lerp(hitTarget, 1 - Math.exp(-dt * 10));
```

```glsl
// GPU: particles near the hit point are pushed outward + jittered
float force = uHitStrength * exp(-dot(toP, toP) * 5.0);
w.xyz += (normalize(toP + vec3(0.001)) + 0.6 * jitter) * force * (0.4 + 0.6 * aRand);
```

Patterns to keep: **feed-and-decay** (events add energy, the loop drains it — motion keeps living briefly after input stops, which reads as physical); **exponential, frame-rate-independent smoothing** (`lerp(target, 1 - exp(-dt·k))` — the correct way to smooth toward a target regardless of fps); gaussian-ish falloff (`exp(-d²·k)`) for locality; `+ vec3(0.001)` to dodge `normalize(0)` = NaN. Also `if (hit.strength < 0.05) hitPoint.copy(hitTarget)` — on fresh entry, teleport the hit point instead of letting it streak across the shape from where it was last time.

The fragment shader fades blasted particles (`alpha *= 1.0 - 0.8 * vHit`) — they scatter *and* dissolve, then heal as strength drains. And `blending: THREE.AdditiveBlending` makes overlapping particles add brightness — the glow look.

### 13.4 Performance hygiene — the checklist to copy

This component mounts **three times** (one per project), each with its own renderer + rAF loop, so it's careful:

- **IntersectionObserver** sets a `visible` flag; the tick loop early-returns when off-screen (rAF still fires but does no work — and crucially, the off-screen GPU does nothing).
- **ResizeObserver** (not window resize) — the canvas sizes to its *container*, which changes with layout, not just window size. `renderer.setSize(w, h, false)` — the `false` stops three.js from stomping the CSS-controlled canvas size.
- **Clamped delta time**: `dt = Math.min((now - last)/1000, 0.05)` — after a backgrounded-tab pause, an unclamped dt would make spin/decay leap.
- All time-based motion uses `+= dt * rate` (accumulation), not absolute clock time — this is what allows pausing while invisible without a jump on return.
- Full disposal in cleanup: observers, trigger, listeners, geometries, material, renderer.
- `useEffect(..., [kind])` — if the `kind` prop ever changed, the whole scene tears down and rebuilds. The dependency array as resource lifetime binding.

**Mental model recap:** ProjectVisual = Hero's architecture generalized: one shader parameterized by per-particle attributes, three shape builders behind a dispatch table, every behavior (assemble, breathe, comet, blast) driven by a handful of scalar uniforms that CPU-side GSAP/decay-loops nudge. GPU does per-particle work; CPU animates single numbers.

---

## 14. `Contact.tsx` and `Footer.tsx` (quick)

**Contact** is the section skeleton + two anime.js touches: an infinitely looping radar ring (`scale 1→3, opacity 0.6→0`) on the "available" dot, and a hover wave on the email — `splitChars` again, then per-char keyframes (up 12px fast, back with `outElastic` bounce, `stagger(18)` → traveling wave). The `waving` flag debounces re-entry: without it, hovering twice mid-wave restarts and the letters pop. Manual debounce-by-flag, same idea as `flippingRef`.

**Footer** is the only other server component besides layout/page — no `"use client"`, no hooks, just `data.ts` and `new Date().getFullYear()`. When a component has no interactivity, leaving it as a server component ships zero JS for it. The gotcha lurking in it: the year is computed at *render time on the server* — with static generation that's *build* time, so a site built Dec 31 shows the old year until rebuilt. Harmless here, but remember: server components run at build/request time, not in the user's browser.

---

## 15. `globals.css` — the parts that carry logic

One global stylesheet, BEM-ish naming (`.hero__content`, `.skills__tab--active`), design tokens as CSS variables:

```css
:root { --bg: #0a0a0a; --ink: #e8e8e4; --ink-dim: ...; --line: ...; }
```

Five tokens drive the whole visual identity — change two values, re-theme the site. The rules that are *load-bearing for the animations* (not just looks):

- `.word { display: inline-block; overflow: hidden; }` + `.char { display: inline-block; }` — the text mask (section 5). Without `inline-block`, spans can't be transformed at all (CSS transforms don't apply to inline elements). **Delete two lines of CSS and every text animation dies.**
- `.nav { opacity: 0 }`, `.skill { opacity: 0 }` — hidden initial states for the no-FOUC handoff patterns (sections 8, 11).
- `.skill--in { opacity: 1 }` and the comment `/* keep after .skill--in: same specificity, later rule wins */` before `.skill--dim` — a deliberate use of the CSS cascade: equal specificity → source order decides, so dim must beat in. Reordering those rules is a real bug.
- `.hero { height: 100svh }` after `height: 100vh` — *small viewport height*: on mobile, `100vh` infamously ignores the browser chrome and overflows; `svh` fixes it; the `vh` line is the fallback for old browsers (later-declaration-wins again, but only if `svh` is supported).
- `will-change: transform` on `.char`/`.skill` — promotes elements to GPU compositing layers ahead of animation. Use sparingly; it costs memory.
- `@media (prefers-reduced-motion: reduce)` — the CSS half of the accessibility story: forces `.nav`, `.skill` (etc.) visible, since the JS that would have revealed them returned early. **Both layers must agree** — JS skips animations, CSS supplies the end states. Miss one side and reduced-motion users get a blank page.
- `.project:nth-child(even) .project__visual { order: 2 }` — alternating layout, undone in the mobile media query.
- `scroll-behavior: smooth` on `html` — the entire smooth-anchor-nav "system".

---

## 16. Cross-cutting patterns — the transferable list

**General patterns you will see in every animated React/Next project:**

1. `"use client"` boundary; effects are the only browser-guaranteed zone.
2. ref + `useEffect` + cleanup = the React↔imperative-library airlock (§7).
3. `gsap.context` / `ctx.revert()` for transactional animation cleanup; strict mode double-mount is the test your cleanup must pass.
4. `useState` for UI-changing state, refs for frame-rate state and for fresh reads inside once-created callbacks (stale closures, §11.1).
5. Split text + `overflow: hidden` parent = masked text reveal (§5).
6. ScrollTrigger three modes: `once: true` (reveals), `onToggle` (reversible), `scrub + pin` (scroll-driven stories).
7. FLIP + `useLayoutEffect` for animating layout changes (§11.3).
8. CPU animates scalars, GPU does per-element work via uniforms; plain-object tweens as the bridge (§9.4, §13.2).
9. Feed-and-decay energy + `1 - exp(-dt·k)` smoothing for organic cursor response (§13.3).
10. Reduced-motion respected in *both* JS and CSS.
11. Disposal checklist: rAF, listeners, observers, triggers, geometries, materials, renderer.
12. Ownership handoffs when multiple systems animate one element: wipe inline styles, zero transforms, guard flags (§11).

**Choices specific to this project (taste, not law):**

- Three animation libraries at once (gsap = choreography, anime = elastic/loops, three = GPU). Many projects use gsap alone.
- Vanilla CSS with BEM instead of Tailwind/CSS modules.
- Data attributes (`data-reveal`) as the animation opt-in API.
- Hand-rolled `splitChars` instead of a library.
- All content in one `data.ts`.

**Gotchas index (the bugs you'd hit rebuilding this):**

| Gotcha | Where | Fix used here |
|---|---|---|
| Strict mode runs effects twice in dev | every effect | real cleanups; idempotent `splitChars` |
| `window` doesn't exist during SSR | split.ts | `typeof window !== "undefined"` |
| Inline styles from one lib break another | Skills | wipe styles on handoff, `gsap.set({x:0,y:0})` before FLIP |
| Stale closure over state in once-created handlers | Skills | mirror state into a ref |
| Measuring an element you've offset | Skills magnet | subtract current `x`/`y` to get rest frame |
| FLIP flickers if run after paint | Skills | `useLayoutEffect` |
| Transforms don't work on inline elements | split CSS | `display: inline-block` |
| `100vh` overflows on mobile | hero CSS | `100svh` with `vh` fallback |
| GPU memory isn't GC'd | Hero, ProjectVisual | `.dispose()` everything |
| Huge dt after tab switch | ProjectVisual | clamp dt; accumulate elapsed |
| `normalize(vec3(0))` = NaN in GLSL | blast shader | `+ vec3(0.001)` |
| Pin jump on fast scroll | Hero | `anticipatePin: 1` |
| Equal-specificity CSS rules | .skill--dim | rely on source order, comment it |
| Reduced motion leaves elements hidden | Nav, Skills | CSS media query forces end states |

---

## 17. Rebuild-it-yourself checklist

The order you'd actually build this in, with the notebook section to consult:

1. `npx create-next-app` → strip to layout + page; set up tokens and base CSS (§3, §15).
2. Write `lib/data.ts` first — content model before components (§4).
3. Static, unanimated versions of all sections; semantic HTML, ids for anchors (§10, §12).
4. `split.ts` + the `.word`/`.char` CSS; verify the mask with a hardcoded `gsap.from` (§5).
5. `useReveal` hook; tag sections with data attributes (§6).
6. Nav fade-in + scrolled state (§8).
7. Hero: scene boilerplate → flat grid → waves in shader (uTime) → mouse ripple (raycaster + uMouse) → entrance timeline → scrub/pin timeline with the `state` bridge (§9, in that order — each step is testable).
8. ProjectVisual: pulse sphere first (simplest builder) → assemble-on-scroll → tilt → blast → globe and rings builders (§13).
9. Skills: render + filter with no animation → entrance → FLIP → magnet, in that order, adding the guard flags as systems collide (§11).
10. Contact flourishes (§14). Reduced-motion pass over everything, both JS and CSS (§16).
11. Cleanup audit: navigate-away and dev double-mount without console errors or leaked loops.

If you can do those eleven steps without reading the source, you own this codebase.

