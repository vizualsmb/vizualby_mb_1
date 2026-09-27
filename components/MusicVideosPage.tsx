"use client";

import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { musicVideos } from "@/data/musicVideos";
import { Header } from "./Header";
import { CustomCursor } from "./CustomCursor";
import { Footer } from "./Footer";
import { SmoothScrollProvider } from "./SmoothScrollProvider";
import { MediaGrid } from "./MediaGrid";

export function MusicVideosPage() {
  const items = musicVideos.map((item) => ({
    key: item.video,
    title: item.title,
    video: item.video,
    poster: item.poster,
    tag: item.year,
    orientation: "landscape" as const,
    secondaryHref: item.caseStudy,
    secondaryLabel: "View case study",
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
            <h1 className="media-showcase-mark">Music videos</h1>
            <p className="media-showcase-meta">{items.length} film{items.length === 1 ? "" : "s"} — full volume</p>
          </div>
          <MediaGrid items={items} />
        </section>

        <Link className="aftermovies-contact" href="/#contact">
          <span>Have a track in motion?</span>
          <strong>Start a project</strong>
          <ArrowUpRight size={36} strokeWidth={1} />
        </Link>
      </main>
      <Footer />
    </SmoothScrollProvider>
  );
}
