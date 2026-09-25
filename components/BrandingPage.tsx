"use client";

import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { brandingProjects } from "@/data/branding";
import { Header } from "./Header";
import { CustomCursor } from "./CustomCursor";
import { Footer } from "./Footer";
import { SmoothScrollProvider } from "./SmoothScrollProvider";
import { VideoReelRail } from "./VideoReelRail";

export function BrandingPage() {
  const items = brandingProjects.map((item) => ({
    key: item.video,
    title: item.title,
    video: item.video,
    poster: item.poster,
    tag: item.type,
    orientation: "portrait" as const,
  }));

  return (
    <SmoothScrollProvider>
      <Header />
      <CustomCursor />
      <main className="aftermovies-page" id="main-content">
        <section className="aftermovies-hero format-stage" data-format="branding">
          <Link href="/#categories" className="aftermovies-back">
            <ArrowLeft size={17} /> All formats
          </Link>
          <div className="format-stage-rail">
            <VideoReelRail
              items={items}
              label="Select branding project"
              category="Branding"
              descriptor="Identity · campaign · product"
            />
          </div>
          <div className="aftermovies-title">
            <p>Identity / campaign / product</p>
            <h1>Branding</h1>
            <p>Stories with a point of view.</p>
          </div>
        </section>

        <Link className="aftermovies-contact" href="/#contact">
          <span>Building a brand in motion?</span>
          <strong>Start a project</strong>
          <ArrowUpRight size={36} strokeWidth={1} />
        </Link>
      </main>
      <Footer />
    </SmoothScrollProvider>
  );
}
