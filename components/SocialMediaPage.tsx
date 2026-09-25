"use client";

import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { socialMediaProjects } from "@/data/socialMedia";
import { Header } from "./Header";
import { CustomCursor } from "./CustomCursor";
import { Footer } from "./Footer";
import { SmoothScrollProvider } from "./SmoothScrollProvider";
import { VideoReelRail } from "./VideoReelRail";

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
        <section className="aftermovies-hero format-stage" data-format="social-media">
          <Link href="/#categories" className="aftermovies-back">
            <ArrowLeft size={17} /> All formats
          </Link>
          <div className="format-stage-rail">
            <VideoReelRail
              items={items}
              label="Select project"
              category="Social media"
              descriptor="Campaigns · promos · short form"
            />
          </div>
          <div className="aftermovies-title">
            <p>Campaigns / promos / short form</p>
            <h1>Social media</h1>
            <p>Made for the scroll.</p>
          </div>
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
