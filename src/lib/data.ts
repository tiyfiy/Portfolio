// Placeholder content — edit this file to make the portfolio yours.

export const profile = {
  name: "Timotej Maučec",
  role: "Full-Stack Developer",
  email: "timotejmau@gmail.com",
  socials: [
    { label: "GitHub", href: "https://github.com/" },
    { label: "LinkedIn", href: "https://linkedin.com/" },
    { label: "X", href: "https://x.com/" },
  ],
};

export type SkillCategory = "frontend" | "backend" | "motion" | "tools";

export const skillCategories: { id: SkillCategory | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "frontend", label: "Frontend" },
  { id: "backend", label: "Backend" },
  { id: "motion", label: "3D & Motion" },
  { id: "tools", label: "Tools" },
];

export const skills: { name: string; category: SkillCategory }[] = [
  { name: "JavaScript", category: "frontend" },
  { name: "TypeScript", category: "frontend" },
  { name: "React", category: "frontend" },
  { name: "Next.js", category: "frontend" },
  { name: "Tailwind CSS", category: "frontend" },
  { name: "Node.js", category: "backend" },
  { name: "Express", category: "backend" },
  { name: "PostgreSQL", category: "backend" },
  { name: "MongoDB", category: "backend" },
  { name: "GraphQL", category: "backend" },
  { name: "Three.js", category: "motion" },
  { name: "WebGL / GLSL", category: "motion" },
  { name: "GSAP", category: "motion" },
  { name: "anime.js", category: "motion" },
  { name: "Docker", category: "tools" },
  { name: "Git / CI-CD", category: "tools" },
  { name: "Vite", category: "tools" },
  { name: "Vitest", category: "tools" },
  { name: "Figma", category: "tools" },
];

export type ProjectVisualKind = "pulse" | "globe" | "rings";

export type Project = {
  title: string;
  description: string;
  tags: string[];
  href: string;
  visual: ProjectVisualKind;
};

export const projects: Project[] = [
  {
    title: "Pulse",
    description:
      "Realtime analytics dashboard streaming live metrics over WebSockets, with custom-drawn charts that stay smooth at 60fps even under heavy data load.",
    tags: ["React", "Node.js", "WebSockets", "D3"],
    href: "#",
    visual: "pulse",
  },
  {
    title: "Atlas",
    description:
      "Headless e-commerce platform with server-rendered storefronts, Stripe checkout, and an admin panel for inventory and order management.",
    tags: ["Next.js", "PostgreSQL", "Stripe", "Prisma"],
    href: "#",
    visual: "globe",
  },
  {
    title: "Orbit",
    description:
      "Interactive 3D product configurator — custom GLSL materials, physically-based lighting, and scroll-choreographed camera moves.",
    tags: ["Three.js", "GLSL", "GSAP", "Vite"],
    href: "#",
    visual: "rings",
  },
];
