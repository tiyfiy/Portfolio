"use client";

import { useRef } from "react";
import { useReveal } from "@/hooks/useReveal";

export default function About() {
  const ref = useRef<HTMLElement>(null);
  useReveal(ref);

  return (
    <section ref={ref} className="section about" id="about">
      <p className="section__index" data-reveal>
        01
      </p>
      <h2 className="section__title" data-split-scroll>
        About
      </h2>
      <div className="about__grid">
        <p className="about__lead" data-reveal>
          I&apos;m a CS student working as a freelance full-stack developer.
        </p>
        <div className="about__body" data-reveal>
          <p>
            Most of my work is full-stack, but the part I keep coming back to
            is the data-heavy backend side: live streams, message queues, and
            systems that have to stay correct under load. I like understanding
            a problem all the way down before I write anything, because the
            simplest solution only looks simple if you know why it works. Clean
            code, choices I can defend, nothing clever for the sake of it.
          </p>
        </div>
      </div>
    </section>
  );
}
