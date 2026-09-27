"use client";

import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { socialMediaProjects } from "@/data/socialMedia";
import { Header } from "./Header";
import { CustomCursor } from "./CustomCursor";
import { Footer } from "./Footer";
import { SmoothScrollProvider } from "./SmoothScrollProvider";
import { MediaGrid } from "./MediaGrid";

export function SocialMediaPage() {
  const items = socialMediaProjects.map((item) => ({
    key: item.video,
    title: item.title,
    video: item.video,
    poster: item.poster,
    tag: "Short form",
    orientation: "portrait" as const,
  }));

  return (
    <SmoothScrollProvider>
      <Header />
      <CustomCursor />
      <main className="aftermovies-page" id="main-content">
        <section className="media-showcase">
          <div className="media-showcase-bar">
            <Link href="/#categories" className="aftermovies-back">
              <ArrowLeft size={17} /> All formats
            </Link>
            <h1 className="media-showcase-mark">Social media</h1>
            <p className="media-showcase-meta">{items.length} projects — made for the scroll</p>
          </div>
          <MediaGrid items={items} />
        </section>

        <Link className="aftermovies-contact" href="/#contact">
          <span>Have a campaign in mind?</span>
          <strong>Start a project</strong>
          <ArrowUpRight size={36} strokeWidth={1} />
        </Link>
      </main>
      <Footer />
    </SmoothScrollProvider>
  );
}
