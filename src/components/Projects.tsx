"use client";

import { useRef } from "react";
import { useReveal } from "@/hooks/useReveal";
import { projects } from "@/lib/data";
import ProjectVisual from "@/components/ProjectVisual";

export default function Projects() {
  const ref = useRef<HTMLElement>(null);
  useReveal(ref);

  return (
    <section ref={ref} className="section projects" id="projects">
      <p className="section__index" data-reveal>
        03
      </p>
      <h2 className="section__title" data-split-scroll>
        Selected work
      </h2>
      <div className="projects__list">
        {projects.map((project) => (
          <article key={project.title} className="project" data-reveal>
            <ProjectVisual kind={project.visual} />
            <div className="project__info">
              <h3 className="project__title">{project.title}</h3>
              <p className="project__desc">{project.description}</p>
              <div className="project__tags">
                {project.tags.map((tag) => (
                  <span key={tag} className="project__tag">
                    {tag}
                  </span>
                ))}
              </div>
              {project.href && (
                <a
                  className="project__link"
                  href={project.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View project →
                </a>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
