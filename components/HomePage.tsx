"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { projects } from "@/data/projects";
import { services, site } from "@/data/site";
import { Header } from "./Header";
import { IntroLogo } from "./IntroLogo";
import { ContactForm } from "./ContactForm";
import { CustomCursor } from "./CustomCursor";
import { CinematicPreview } from "./CinematicPreview";
import { Footer } from "./Footer";
import { SmoothScrollProvider } from "./SmoothScrollProvider";
import { MagneticButton } from "./MagneticButton";
import { DirectorReel } from "./DirectorReel";
import { FormatRail } from "./FormatRail";

const aboutStats = [
  { value: "50+", label: "Projects" },
  { value: "5+", label: "Years" },
  { value: "∞", label: "Stories to tell" },
];

const formatCategories = [
  {
    index: "01",
    label: "Night Life",
    title: "Night Life",
    description: "Real moments. Real energy. Clubs, concerts, and events brought to life through a cinematic lens.",
    href: "/aftermovies",
    video: "/video/aftermovies/preview.mp4",
    poster: "/images/aftermovies/saii-2.webp",
  },
  {
    index: "02",
    label: "Music",
    title: "Music Videos",
    description: "From concept to final cut. Cinematic music videos that elevate the sound and tell the story.",
    href: "/music-videos",
    video: "/video/elliott-santini-medomina-preview.mp4",
    poster: "/images/medomina-1.webp",
  },
  {
    index: "03",
    label: "Social",
    title: "Content Series",
    description: "Short-form visuals designed to grow your brand and keep your audience engaged.",
    href: "/social-media",
    video: "/video/social-media/preview.mp4",
    poster: "/images/social-media/andy-promo.webp",
  },
  {
    index: "04",
    label: "Narrative",
    title: "Short Films",
    description: "Original stories with intention. Cinematic visuals, deeper meaning, longer impact.",
    href: "/short-films",
    video: "/video/short-films/preview.mp4",
    poster: "/images/short-films/streamer-university.webp",
  },
];

gsap.registerPlugin(ScrollTrigger);

const INTRO_STORAGE_KEY = "vizual-by-mb-intro-seen";
const subscribeToIntroStorage = () => () => undefined;
const getIntroServerSnapshot = () => false;
const getIntroSnapshot = () => {
  try {
    return window.sessionStorage.getItem(INTRO_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};

export function HomePage() {
  const introWasSeen = useSyncExternalStore(subscribeToIntroStorage, getIntroSnapshot, getIntroServerSnapshot);
  const [introComplete, setIntroComplete] = useState(false);
  const intro = !introWasSeen && !introComplete;
  const main = useRef<HTMLElement>(null);
  const finishIntro = useCallback(() => {
    try {
      window.sessionStorage.setItem(INTRO_STORAGE_KEY, "true");
    } catch {
      // The intro still completes when storage is unavailable.
    }
    setIntroComplete(true);
  }, []);

  // Clip the outlined "instinct" copy to the director cutout so the stroke only shows where the word meets his head.
  useEffect(() => {
    const stage = document.querySelector<HTMLElement>(".about-stage");
    const cutout = stage?.querySelector<HTMLElement>(".about-cutout");
    const ghost = stage?.querySelector<HTMLElement>(".about-title-ghost");
    if (!stage || !cutout || !ghost) return;
    const update = () => {
      ghost.style.setProperty("--cutout-mask-size", `${cutout.offsetWidth}px ${cutout.offsetHeight}px`);
      ghost.style.setProperty("--cutout-mask-pos", `${cutout.offsetLeft - ghost.offsetLeft}px ${cutout.offsetTop - ghost.offsetTop}px`);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [intro]);

  useEffect(() => {
    if (intro) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const ctx = gsap.context(() => {
      gsap.from(".hero-meta", { opacity: 0, y: 18, duration: 0.8, delay: 0.5 });
      gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((element) => {
        gsap.from(element, { y: 70, opacity: 0, duration: 1, ease: "power3.out", scrollTrigger: { trigger: element, start: "top 86%" } });
      });
      gsap.utils.toArray<HTMLElement>(".project-media img, .project-media video").forEach((media) => {
        gsap.fromTo(media, { scale: 1.08 }, { scale: 1, ease: "none", scrollTrigger: { trigger: media, start: "top bottom", end: "bottom top", scrub: true } });
      });
    }, main);
    return () => ctx.revert();
  }, [intro]);

  return (
    <SmoothScrollProvider>
      {intro && <IntroLogo onComplete={finishIntro} />}
      <Header />
      <CustomCursor />
      <main ref={main} id="main-content">
        <section className="hero" id="top">
          <CinematicPreview
            className="hero-video"
            src="/video/mb-hero-web.mp4"
            highQualitySrc="/video/mb-hero-hq-hevc.mp4"
            poster="/images/mb-hero-2-poster.webp"
            fallback="/logo/mb-white.png"
            priority
            active={!intro}
          />
          <div className="hero-kicker"><span>Independent creative direction</span></div>
          <div className="hero-title">
            <p>Director / Filmmaker / Visual storyteller</p>
          </div>
          <div className="hero-meta">
            <p>Cinematic films, campaigns, and social stories shaped from concept through final frame.</p>
            <div className="hero-actions"><a href="#work">View work <ArrowDown size={17} /></a><a href="#contact">Start a project <ArrowUpRight size={17} /></a></div>
          </div>
        </section>

        <section className="work" id="work">
          <div className="section-head" data-reveal><p>Selected work</p><p>({String(projects.length).padStart(2, "0")} projects)</p></div>
          <div className="project-list">
            {projects.map((project, index) => (
              <article className={`project project-${project.orientation} ${index % 2 ? "project-offset" : ""}`} key={project.slug} data-reveal>
                <Link href={`/work/${project.slug}`} className={`project-media project-media-${project.orientation}`} aria-label={`View ${project.title} case study`}>
                  {project.videoPreview ? (
                    <CinematicPreview src={project.videoPreview} poster={project.image} />
                  ) : (
                    <Image src={project.image} alt={`${project.title} campaign`} fill sizes="(max-width: 768px) 100vw, 84vw" priority={index === 0} />
                  )}
                  <span className="project-index">0{index + 1}</span>
                  <span className="project-view">View project <ArrowUpRight size={18} /></span>
                </Link>
                <div className="project-caption">
                  {project.orientation === "portrait" && (
                    <div className="portrait-discipline" aria-hidden="true">
                      <span>Discipline</span><span>Builds</span><span>Freedom</span>
                    </div>
                  )}
                  <h2>
                    {project.orientation === "portrait" && project.title.includes(" / ") ? (
                      project.title.split(" / ").map((part, titleIndex) => (
                        <span key={part}>{part}{titleIndex === 0 ? " / " : ""}</span>
                      ))
                    ) : project.title}
                  </h2>
                  {project.orientation === "portrait" && (
                    <p className="portrait-summary">A visceral training portrait of Anderson Correia, built around repetition, focus, and the physical discipline behind elite performance.</p>
                  )}
                  {project.orientation === "portrait" && (
                    <div className="portrait-mantra" aria-hidden="true">
                      <span>Body</span><span>Mind</span><span>Game</span>
                    </div>
                  )}
                  <div className="project-meta">
                    <div className="project-tags">
                      {project.category.split(" / ").map((tag) => <span key={tag}>{tag}</span>)}
                    </div>
                    <p>{project.year}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="work-categories" id="categories">
          <div className="section-head light" data-reveal><p>Select a discipline</p><p>Vizuals by MB</p></div>
          <div className="format-desktop">
            {formatCategories.map((category) => (
              <article className="category-row" key={category.href} data-reveal>
                <Link className="category-card" href={category.href} aria-label={`View ${category.title} projects`}>
                  <div className="category-media">
                    <CinematicPreview src={category.video} poster={category.poster} />
                  </div>
                  <span className="category-index">{category.index}</span>
                  <div className="category-copy">
                    <span className="category-label">{category.label}</span>
                    <h2>{category.title}</h2>
                    <p>{category.description}</p>
                    <span className="category-link">
                      Explore <ArrowUpRight size={18} />
                    </span>
                  </div>
                </Link>
              </article>
            ))}
          </div>
          <div className="format-mobile" data-reveal>
            <FormatRail categories={formatCategories} />
          </div>
        </section>

        <section className="about" id="about">
          <div className="section-head light" data-reveal><p>Meet the director</p><p>(Behind the frame)</p></div>
          <div className="about-stage">
            <h2 className="about-title" data-reveal>
              <span>Direction</span>
              <strong>with</strong>
              <em>instinct</em>
              <small>Built on intent.</small>
            </h2>
            <div className="about-lede" data-reveal>
              <p>I build visual worlds from the first idea to the final frame, directing films that feel human, kinetic, and impossible to ignore.</p>
            </div>
            <div className="about-cutout" data-reveal>
              <Image src="/images/about/mb-director-cutout.webp" alt="MB directing on set" fill sizes="(max-width: 800px) 72vw, 38vw" />
            </div>
            <div className="about-title about-title-ghost" aria-hidden="true" data-reveal>
              <span>Direction</span>
              <strong>with</strong>
              <em>instinct</em>
              <small>Built on intent.</small>
            </div>
            <div className="about-reel-wrap" data-reveal><DirectorReel /></div>
          </div>
          <dl className="about-stats" data-reveal>
            {aboutStats.map((stat) => (
              <div key={stat.label}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>
            ))}
          </dl>
          <div className="about-notes" data-reveal>
            <div className="about-copy">
              <p>Working across music, culture, sport, events, and branded content, I bring a filmmaker&apos;s eye to every stage: concept, treatment, production, edit, color, and sound.</p>
            </div>
            <MagneticButton href="#contact">Start a project</MagneticButton>
          </div>
        </section>

        <section className="services" id="services">
          <div className="section-head" data-reveal><p>Capabilities</p><p>(What I do)</p></div>
          <div className="service-list">
            {services.map((service, index) => (
              <div className="service-row" key={service.title} data-reveal>
                <span>0{index + 1}</span>
                <div className="service-main"><h3>{service.title}</h3><p>{service.detail}</p></div>
              </div>
            ))}
          </div>
          <div className="marquee" aria-hidden="true"><div>{services.concat(services).map((service, i) => <span key={`${service.title}-${i}`}>{service.title}<b>+</b></span>)}</div></div>
        </section>

        <section className="contact" id="contact">
          <div className="contact-intro" data-reveal>
            <p>{site.availability}</p>
            <h2>Have something<br /><em>in mind?</em></h2>
          </div>
          <ContactForm />
        </section>
      </main>
      <Footer />
    </SmoothScrollProvider>
  );
}
