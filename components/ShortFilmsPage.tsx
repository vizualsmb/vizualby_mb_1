"use client";

import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { shortFilms } from "@/data/shortFilms";
import { Header } from "./Header";
import { CustomCursor } from "./CustomCursor";
import { Footer } from "./Footer";
import { SmoothScrollProvider } from "./SmoothScrollProvider";
import { VideoReelRail } from "./VideoReelRail";

export function ShortFilmsPage() {
  const items = shortFilms.map((item) => ({
    key: item.video,
    title: item.title,
    video: item.video,
    poster: item.poster,
    tag: "Short film",
    orientation: item.format,
    secondaryHref: item.caseStudy,
  }));

  return (
    <SmoothScrollProvider>
      <Header />
      <CustomCursor />
      <main className="aftermovies-page" id="main-content">
        <section className="aftermovies-hero format-stage" data-format="short-films">
          <Link href="/#categories" className="aftermovies-back">
            <ArrowLeft size={17} /> All formats
          </Link>
          <div className="format-stage-rail">
            <VideoReelRail
              items={items}
              label="Select short film"
              category="Short films"
              descriptor="Narrative · character · atmosphere"
            />
          </div>
          <div className="aftermovies-title">
            <p>Narrative / character / atmosphere</p>
            <h1>Short films</h1>
            <p>Stories told in minutes, felt for longer.</p>
          </div>
        </section>

        <Link className="aftermovies-contact" href="/#contact">
          <span>Have a story to tell?</span>
          <strong>Start a project</strong>
          <ArrowUpRight size={36} strokeWidth={1} />
        </Link>
      </main>
      <Footer />
    </SmoothScrollProvider>
  );
}
