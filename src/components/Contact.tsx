"use client";

import { useEffect, useRef } from "react";
import { animate, stagger } from "animejs";
import { useReveal } from "@/hooks/useReveal";
import { splitChars, prefersReducedMotion } from "@/lib/split";
import { profile } from "@/lib/data";

export default function Contact() {
  const ref = useRef<HTMLElement>(null);
  const emailRef = useRef<HTMLAnchorElement>(null);
  useReveal(ref);

  useEffect(() => {
    if (prefersReducedMotion()) return;

    // wave through the email letters on hover
    const email = emailRef.current;
    if (!email) return;
    const chars = splitChars(email);

    let waving = false;
    const onEnter = () => {
      if (waving) return;
      waving = true;
      animate(chars, {
        translateY: [
          { to: -12, duration: 220, ease: "outQuad" },
          { to: 0, duration: 480, ease: "outElastic(1, .6)" },
        ],
        delay: stagger(18),
        onComplete: () => (waving = false),
      });
    };

    email.addEventListener("mouseenter", onEnter);
    return () => email.removeEventListener("mouseenter", onEnter);
  }, []);

  return (
    <section ref={ref} className="section contact" id="contact">
      <p className="section__index" data-reveal>
        04
      </p>
      <h2 className="section__title" data-split-scroll>
        Let&apos;s build something
      </h2>
      <div data-reveal>
        <a ref={emailRef} className="contact__email" href={`mailto:${profile.email}`}>
          {profile.email}
        </a>
      </div>
      <div className="contact__socials" data-reveal>
        {profile.socials.map((s) => (
          <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer">
            {s.label}
          </a>
        ))}
      </div>
    </section>
  );
}
