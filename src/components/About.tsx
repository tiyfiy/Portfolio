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
          I&apos;m a full-stack developer who cares as much about the last 16
          milliseconds of a frame as the first byte of a response.
        </p>
        <div className="about__body" data-reveal>
          <p>
            I design and ship complete products: REST and GraphQL APIs, realtime
            backends, and interfaces that feel alive without getting in the way.
            Lately I&apos;ve been deep in WebGL and motion design — turning data
            and interaction into things you can almost touch.
          </p>
          <p>
            When I&apos;m not shipping, I&apos;m prototyping shaders, breaking
            animation libraries, and putting them back together better.
          </p>
        </div>
      </div>
    </section>
  );
}
