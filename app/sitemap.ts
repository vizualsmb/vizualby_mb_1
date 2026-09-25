import type { MetadataRoute } from "next";
import { projects } from "@/data/projects";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://vizualbymb.com";
  return [
    { url: base, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/aftermovies`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/branding`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/music-videos`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/social-media`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/short-films`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    ...projects.map((project) => ({ url: `${base}/work/${project.slug}`, changeFrequency: "monthly" as const, priority: 0.9 })),
  ];
}
