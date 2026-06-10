"use client";

import { useEffect, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { splitChars, prefersReducedMotion } from "@/lib/split";

gsap.registerPlugin(ScrollTrigger);

/**
 * Sets up scroll-in reveals inside a section:
 *  - [data-split-scroll]  → per-character mask reveal (section titles)
 *  - [data-reveal]        → fade + rise
 */
export function useReveal(scope: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = scope.current;
    if (!root || prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      root.querySelectorAll<HTMLElement>("[data-split-scroll]").forEach((el) => {
        const chars = splitChars(el);
        gsap.from(chars, {
          yPercent: 110,
          duration: 0.9,
          ease: "power3.out",
          stagger: 0.025,
          scrollTrigger: { trigger: el, start: "top 85%", once: true },
        });
      });

      root.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
        gsap.from(el, {
          y: 44,
          autoAlpha: 0,
          duration: 1,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
        });
      });
    }, root);

    return () => ctx.revert();
  }, [scope]);
}
