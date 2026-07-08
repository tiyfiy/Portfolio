// Site content lives here.

export const profile = {
  name: "Timotej Maučec",
  role: "Full-Stack Developer",
  email: "timotej.maucec1@gmail.com",
  socials: [
    { label: "GitHub", href: "https://github.com/tiyfiy" },
    {
      label: "LinkedIn",
      href: "https://www.linkedin.com/in/timotej-mau%C4%8Dec-448a1036b/",
    },
  ],
};

export type SkillCategory =
  | "languages"
  | "frontend"
  | "data"
  | "mobile"
  | "tools";

export const skillCategories: { id: SkillCategory | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "languages", label: "Languages" },
  { id: "frontend", label: "Frontend" },
  { id: "data", label: "Data" },
  { id: "mobile", label: "Mobile" },
  { id: "tools", label: "Tools" },
];

export const skills: { name: string; category: SkillCategory }[] = [
  { name: "Go", category: "languages" },
  { name: "Python", category: "languages" },
  { name: "C++", category: "languages" },
  { name: "C# / .NET", category: "languages" },
  { name: "JavaScript", category: "languages" },
  { name: "TypeScript", category: "languages" },
  { name: "Kotlin", category: "languages" },
  { name: "React", category: "frontend" },
  { name: "Next.js", category: "frontend" },
  { name: "Tailwind CSS", category: "frontend" },
  { name: "PostgreSQL", category: "data" },
  { name: "MySQL", category: "data" },
  { name: "MongoDB", category: "data" },
  { name: "Redis", category: "data" },
  { name: "Snowflake", category: "data" },
  { name: "Supabase", category: "data" },
  { name: "Firebase", category: "data" },
  { name: "React Native", category: "mobile" },
  { name: "Flutter", category: "mobile" },
  { name: "Android Studio", category: "mobile" },
  { name: "Git", category: "tools" },
  { name: "Docker", category: "tools" },
  { name: "CI/CD", category: "tools" },
  { name: "Postman", category: "tools" },
  { name: "Wireshark", category: "tools" },
  { name: "DBeaver", category: "tools" },
];

export type ProjectVisualKind = "pulse" | "globe" | "rings";

export type Project = {
  title: string;
  description: string;
  tags: string[];
  href?: string;
  visual: ProjectVisualKind;
};

export const projects: Project[] = [
  {
    title: "Digital twin for city buses",
    description:
      "A live digital twin of a city's bus network. It pulls real-time data and predicts where buses actually are, based on what riders report, not just the official schedule. I built the whole stack: Go backend, database, MQTT pipeline for the live data, admin dashboard, web frontend, an Android app, a desktop client in libGDX, and a blockchain layer that stores the tamper-sensitive records so nobody can quietly rewrite the history.",
    tags: ["Go", "MQTT", "Android", "libGDX", "Blockchain", "Real-time"],
    href: "https://github.com/projectBlockchainRIT/projectMariborBusi",
    visual: "pulse",
  },
  {
    title: "Invoice compliance app for Shopify",
    description:
      "An embedded Shopify app that keeps merchant invoices compliant. I built the auth flow into a Go backend and wired up the webhooks that move the data between Shopify and the app. Embedded app auth is one of those things that sounds trivial until you've actually done it, so getting it clean was the win here.",
    tags: ["Go", "Shopify", "OAuth", "Webhooks"],
    visual: "rings",
  },
];
