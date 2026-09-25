"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowUpRight, Maximize2, X } from "lucide-react";
import { Project, projects } from "@/data/projects";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { SmoothScrollProvider } from "./SmoothScrollProvider";

export function CaseStudyPage({ project }: { project: Project }) {
  const index = projects.findIndex((item) => item.slug === project.slug);
  const next = projects[(index + 1) % projects.length];
  const chapters = [
    { label: "Challenge", copy: project.challenge },
    { label: "Approach", copy: project.approach },
    { label: "Result", copy: project.result },
  ];
  const gallery = project.gallery ?? [project.image, project.image];
  const [activeChapter, setActiveChapter] = useState(0);
  const [activeImage, setActiveImage] = useState<number | null>(null);
  const lightboxCloseRef = useRef<HTMLButtonElement>(null);
  const lightboxRef = useRef<HTMLDivElement>(null);
  const lightboxTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (activeImage === null) return;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setActiveImage(null);
        return;
      }
      if (event.key !== "Tab" || !lightboxRef.current) return;
      const focusable = Array.from(lightboxRef.current.querySelectorAll<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])'));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.body.style.overflow = "hidden";
    lightboxCloseRef.current?.focus();
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      lightboxTriggerRef.current?.focus();
    };
  }, [activeImage]);

  return (
    <SmoothScrollProvider>
      <Header />
      <motion.main id="main-content" className={`case case-${project.orientation}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.65 }}>
        <section className={`case-hero case-hero-${project.orientation}`} id="overview">
          <Link className="case-back" href="/#work"><ArrowLeft size={18} /> Selected work</Link>
          <div className="case-hero-layout">
            <div className="case-heading">
              <p>{project.category}</p>
              <h1 className={project.title.length > 14 ? "long-title" : ""}>{project.title}</h1>
              <div className="case-hero-copy">
                <p>{project.intro}</p>
                <dl>
                  {project.details.map((detail) => <div key={detail.label}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}
                </dl>
              </div>
              <p>{project.year}</p>
            </div>
            <div className={`case-image ${project.video ? `case-video case-video-${project.orientation}` : ""}`}>
              {project.video ? (
                <video
                  controls
                  playsInline
                  preload="none"
                  poster={project.image}
                  aria-label={`${project.title} project film`}
                  onPlay={(event) => { event.currentTarget.muted = false; }}
                >
                  <source src={project.video} type="video/mp4" />
                  Your browser does not support embedded video.
                </video>
              ) : (
                <Image src={project.image} alt={`${project.title} campaign hero`} fill priority sizes="100vw" />
              )}
            </div>
          </div>
        </section>
        <nav className="case-index" aria-label="Project sections">
          <span>Project / 0{index + 1}</span>
          <a href="#overview">Overview</a>
          <a href="#process">Process</a>
          <a href="#services">Services</a>
          <a href="#stills">Stills</a>
        </nav>
        <section className="case-story" id="process">
          <div className="case-story-heading">
            <p className="eyebrow">Creative process</p>
            <h2>Built frame by frame.</h2>
          </div>
          <div className="case-story-panel">
            <div className="case-story-tabs" role="tablist" aria-label="Project process">
              {chapters.map((chapter, chapterIndex) => (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeChapter === chapterIndex}
                  aria-controls="case-story-copy"
                  className={activeChapter === chapterIndex ? "active" : ""}
                  onClick={() => setActiveChapter(chapterIndex)}
                  key={chapter.label}
                >
                  <span>0{chapterIndex + 1}</span>{chapter.label}
                </button>
              ))}
            </div>
            <motion.article
              id="case-story-copy"
              role="tabpanel"
              key={activeChapter}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <span>0{activeChapter + 1}</span>
              <h3>{chapters[activeChapter].label}</h3>
              <p>{chapters[activeChapter].copy}</p>
            </motion.article>
          </div>
        </section>
        <section className="case-deliverables" id="services" aria-labelledby="services-title">
          <div className="case-deliverables-heading">
            <p className="eyebrow">Services</p>
            <h2 id="services-title">What I delivered.</h2>
          </div>
          <div className="case-deliverables-list">
            {project.serviceDetails.map((service, serviceIndex) => (
              <article key={service.title}>
                <span>0{serviceIndex + 1}</span>
                <h3>{service.title}</h3>
                <p>{service.description}</p>
              </article>
            ))}
          </div>
        </section>
        <section className={`case-gallery ${project.gallery ? "gallery-sequence" : ""}`} id="stills" style={{ backgroundColor: project.accent }}>
          <div className="case-gallery-heading"><p className="eyebrow">Selected frames</p><p>Tap a frame to expand</p></div>
          {gallery.map((image, galleryIndex) => (
            <button className={`case-crop gallery-image gallery-image-${galleryIndex + 1}`} onClick={(event) => { lightboxTriggerRef.current = event.currentTarget; setActiveImage(galleryIndex); }} type="button" key={image} aria-label={`Expand project still ${galleryIndex + 1}`}>
              <Image src={image} alt={`${project.title} project still ${galleryIndex + 1}`} fill sizes="(max-width: 800px) 92vw, 72vw" />
              <span className="gallery-count">0{galleryIndex + 1} / 0{gallery.length}</span>
              <span className="gallery-expand"><Maximize2 size={16} /> Expand</span>
            </button>
          ))}
        </section>
        {activeImage !== null && (
          <motion.div ref={lightboxRef} className="case-lightbox" role="dialog" aria-modal="true" aria-label={`Project still ${activeImage + 1}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setActiveImage(null)}>
            <button ref={lightboxCloseRef} type="button" onClick={() => setActiveImage(null)} aria-label="Close expanded image"><X size={24} /></button>
            <div className="case-lightbox-image" onClick={(event) => event.stopPropagation()}>
              <Image src={gallery[activeImage]} alt={`${project.title} project still ${activeImage + 1}`} fill sizes="100vw" priority />
            </div>
            <p>0{activeImage + 1} / 0{gallery.length}</p>
          </motion.div>
        )}
        <Link className="next-project" href={`/work/${next.slug}`}>
          <p>Next project</p><h2>{next.title}</h2><ArrowUpRight size={44} strokeWidth={1} />
        </Link>
      </motion.main>
      <Footer />
    </SmoothScrollProvider>
  );
}
