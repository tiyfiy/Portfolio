"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Flip } from "gsap/Flip";
import { animate, stagger } from "animejs";
import { useReveal } from "@/hooks/useReveal";
import { skills, skillCategories, type SkillCategory } from "@/lib/data";
import { prefersReducedMotion } from "@/lib/split";

gsap.registerPlugin(ScrollTrigger, Flip);

type Filter = SkillCategory | "all";

const MAGNET_RADIUS = 120;
const MAGNET_STRENGTH = 0.32;

export default function Skills() {
  const ref = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [entered, setEntered] = useState(false);
  const enteredRef = useRef(false);
  const flippingRef = useRef(false);
  const flipState = useRef<ReturnType<typeof Flip.getState> | null>(null);
  const flipAnim = useRef<gsap.core.Timeline | null>(null);
  useReveal(ref);

  const markEntered = () => {
    enteredRef.current = true;
    setEntered(true);
  };

  // entrance: elastic stagger when scrolled into view
  useEffect(() => {
    const grid = gridRef.current!;
    const pills = Array.from(grid.querySelectorAll<HTMLElement>(".skill"));

    if (prefersReducedMotion()) {
      markEntered();
      return;
    }

    const trigger = ScrollTrigger.create({
      trigger: grid,
      start: "top 85%",
      once: true,
      onEnter: () => {
        animate(pills, {
          opacity: [0, 1],
          translateY: [22, 0],
          scale: [0.7, 1],
          duration: 850,
          delay: stagger(45),
          ease: "outElastic(1, .7)",
          onComplete: () => {
            // hand visual control back to CSS/GSAP (class keeps them visible)
            markEntered();
            pills.forEach((p) => {
              p.style.opacity = "";
              p.style.transform = "";
            });
          },
        });
      },
    });

    return () => trigger.kill();
  }, []);

  // magnetic pull: pills lean toward the cursor and ease back
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const grid = gridRef.current!;
    const movers = Array.from(grid.querySelectorAll<HTMLElement>(".skill")).map(
      (el) => ({
        el,
        toX: gsap.quickTo(el, "x", { duration: 0.4, ease: "power3" }),
        toY: gsap.quickTo(el, "y", { duration: 0.4, ease: "power3" }),
      })
    );

    const onMove = (e: PointerEvent) => {
      if (!enteredRef.current || flippingRef.current) return;
      for (const m of movers) {
        if (m.el.classList.contains("skill--dim")) {
          m.toX(0);
          m.toY(0);
          continue;
        }
        const r = m.el.getBoundingClientRect();
        // rect moves with the magnet offset; subtract it to get the resting center
        const cx = r.left + r.width / 2 - Number(gsap.getProperty(m.el, "x"));
        const cy = r.top + r.height / 2 - Number(gsap.getProperty(m.el, "y"));
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const d = Math.hypot(dx, dy);
        if (d < MAGNET_RADIUS) {
          const pull = (1 - d / MAGNET_RADIUS) * MAGNET_STRENGTH;
          m.toX(dx * pull);
          m.toY(dy * pull);
        } else {
          m.toX(0);
          m.toY(0);
        }
      }
    };

    const onLeave = () => {
      for (const m of movers) {
        m.toX(0);
        m.toY(0);
      }
    };

    grid.addEventListener("pointermove", onMove);
    grid.addEventListener("pointerleave", onLeave);
    return () => {
      grid.removeEventListener("pointermove", onMove);
      grid.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  const isMatch = (cat: SkillCategory) => filter === "all" || cat === filter;

  const onTab = (next: Filter) => {
    if (next === filter) return;
    if (!prefersReducedMotion() && gridRef.current) {
      // stop any in-flight shuffle where it is; the new flip starts from there
      flipAnim.current?.kill();
      flipState.current = Flip.getState(gridRef.current.querySelectorAll(".skill"));
    }
    setFilter(next);
  };

  // after React reorders the pills, glide them from old to new positions
  useLayoutEffect(() => {
    const state = flipState.current;
    if (!state) return;
    flipState.current = null;
    const pills = gridRef.current!.querySelectorAll(".skill");
    flippingRef.current = true;
    gsap.set(pills, { x: 0, y: 0 }); // drop magnet offsets so pills land on the grid
    flipAnim.current = Flip.from(state, {
      duration: 0.75,
      ease: "power3.inOut",
      stagger: 0.012,
      onComplete: () => {
        flippingRef.current = false;
      },
    });
  }, [filter]);

  const sorted =
    filter === "all"
      ? skills
      : [...skills].sort(
          (a, b) => Number(isMatch(b.category)) - Number(isMatch(a.category))
        );

  return (
    <section ref={ref} className="section skills" id="skills">
      <p className="section__index" data-reveal>
        02
      </p>
      <h2 className="section__title" data-split-scroll>
        Skills
      </h2>
      <div className="skills__tabs" data-reveal>
        {skillCategories.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`skills__tab${filter === c.id ? " skills__tab--active" : ""}`}
            onClick={() => onTab(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div ref={gridRef} className="skills__grid">
        {sorted.map((s) => (
          <span
            key={s.name}
            className={`skill${entered ? " skill--in" : ""}${
              isMatch(s.category) ? "" : " skill--dim"
            }`}
          >
            {s.name}
          </span>
        ))}
      </div>
    </section>
  );
}
