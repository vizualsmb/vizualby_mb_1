import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/metadata";
import { CaseStudyPage } from "@/components/CaseStudyPage";
import { getProject, projects } from "@/data/projects";

export function generateStaticParams() {
  return projects.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const project = getProject((await params).slug);
  return project ? pageMetadata({ title: project.title, description: project.intro, path: `/work/${project.slug}`, image: project.image }) : {};
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const project = getProject((await params).slug);
  if (!project) notFound();
  return <CaseStudyPage project={project} />;
}
