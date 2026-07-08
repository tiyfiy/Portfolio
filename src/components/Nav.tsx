"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { prefersReducedMotion } from "@/lib/split";

export default function Nav() {
  const navRef = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const nav = navRef.current!;

    if (prefersReducedMotion()) {
      gsap.set(nav, { opacity: 1 });
    } else {
      gsap.set(nav, { y: -16 });
      gsap.to(nav, { opacity: 1, y: 0, duration: 1, delay: 1.4, ease: "power2.out" });
    }

    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav ref={navRef} className={`nav${scrolled ? " nav--scrolled" : ""}`}>
      <a
        className="nav__logo"
        href="#top"
        onClick={(e) => {
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      >
        TM.
      </a>
      <div className="nav__links">
        <a href="#about">About</a>
        <a href="#skills">Skills</a>
        <a href="#projects">Projects</a>
        <a href="#contact">Contact</a>
      </div>
    </nav>
  );
}
