"use client";

import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { musicVideos } from "@/data/musicVideos";
import { Header } from "./Header";
import { CustomCursor } from "./CustomCursor";
import { Footer } from "./Footer";
import { SmoothScrollProvider } from "./SmoothScrollProvider";
import { VideoReelRail } from "./VideoReelRail";

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
        <section className="aftermovies-hero format-stage" data-format="music-videos">
          <Link href="/#categories" className="aftermovies-back">
            <ArrowLeft size={17} /> All formats
          </Link>
          <div className="format-stage-rail">
            <VideoReelRail
              items={items}
              label="Select music video"
              category="Music videos"
              descriptor="Performance · culture · visual worlds"
            />
          </div>
          <div className="aftermovies-title">
            <p>Performance / culture / visual worlds</p>
            <h1>Music videos</h1>
            <p>{musicVideos.length.toString().padStart(2, "0")} film</p>
          </div>
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
