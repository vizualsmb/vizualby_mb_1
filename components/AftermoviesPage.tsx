"use client";

import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { aftermovies } from "@/data/aftermovies";
import { Header } from "./Header";
import { CustomCursor } from "./CustomCursor";
import { Footer } from "./Footer";
import { SmoothScrollProvider } from "./SmoothScrollProvider";
import { MediaGrid } from "./MediaGrid";

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
        <section className="media-showcase">
          <div className="media-showcase-bar">
            <Link href="/#categories" className="aftermovies-back">
              <ArrowLeft size={17} /> All formats
            </Link>
            <h1 className="media-showcase-mark">Aftermovies</h1>
            <p className="media-showcase-meta">{items.length} films — full volume</p>
          </div>
          <MediaGrid items={items} />
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
