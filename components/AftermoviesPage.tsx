"use client";

import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { aftermovies } from "@/data/aftermovies";
import { Header } from "./Header";
import { CustomCursor } from "./CustomCursor";
import { Footer } from "./Footer";
import { SmoothScrollProvider } from "./SmoothScrollProvider";
import { VideoReelRail } from "./VideoReelRail";

export function AftermoviesPage() {
  const items = aftermovies.map((item) => ({
    key: item.video,
    title: item.title,
    video: item.video,
    poster: item.poster,
    tag: item.format === "portrait" ? "Portrait" : "Landscape",
    orientation: item.format,
  }));

  return (
    <SmoothScrollProvider>
      <Header />
      <CustomCursor />
      <main className="aftermovies-page" id="main-content">
        <section className="aftermovies-hero format-stage" data-format="aftermovies">
          <Link href="/#categories" className="aftermovies-back">
            <ArrowLeft size={17} /> All formats
          </Link>
          <div className="format-stage-rail">
            <VideoReelRail
              items={items}
              label="Select aftermovie"
              category="Aftermovies"
              descriptor="Live event · nightlife · culture"
              initialIndex={1}
            />
          </div>
          <div className="aftermovies-title">
            <p>Live events / nightlife / culture</p>
            <h1>Aftermovies</h1>
            <p>Six films. Full volume.</p>
          </div>
        </section>

        <Link className="aftermovies-contact" href="/#contact">
          <span>Need your event captured?</span>
          <strong>Start a project</strong>
          <ArrowUpRight size={36} strokeWidth={1} />
        </Link>
      </main>
      <Footer />
    </SmoothScrollProvider>
  );
}
