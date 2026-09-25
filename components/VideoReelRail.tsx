"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Maximize, Pause, Play, ArrowUpRight } from "lucide-react";
import type { KeyboardEvent, MouseEvent, PointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

type FullscreenVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

// Averages a frame region and lifts it into a glow-friendly color (saturated, mid lightness).
function glowColor(data: Uint8ClampedArray, width: number, height: number, x0: number, x1: number) {
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = 0; y < height; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4;
      const weight = 1 + Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]);
      r += data[i] * weight; g += data[i + 1] * weight; b += data[i + 2] * weight; n += weight;
    }
  }
  r /= n * 255; g /= n * 255; b /= n * 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0;
  if (max !== min) {
    const d = max - min;
    h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  const l = (max + min) / 2;
  const sat = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
  return `hsl(${Math.round(h)} ${Math.round(Math.min(85, sat * 100 * 1.4 + 12))}% ${Math.round(Math.min(52, Math.max(34, l * 100 + 8)))}%)`;
}

function sampleStageColors(source: CanvasImageSource) {
  const canvas = document.createElement("canvas");
  canvas.width = 24;
  canvas.height = 14;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  try {
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    return [glowColor(data, 24, 14, 0, 10), glowColor(data, 24, 14, 14, 24)] as const;
  } catch {
    return null;
  }
}

export type ReelItem = {
  key: string;
  title: string;
  video: string;
  poster: string;
  tag?: string;
  orientation?: "landscape" | "portrait";
  secondaryHref?: string;
  secondaryLabel?: string;
};

function ReelCard({
  item,
  index,
  total,
  active,
  onActivate,
  category,
  descriptor,
}: {
  item: ReelItem;
  index: number;
  total: number;
  active: boolean;
  onActivate: (index: number) => void;
  category: string;
  descriptor: string;
}) {
  const card = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = card.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.35 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    if (active && inView && !reducedMotion && !coarsePointer) {
      void element.play().catch(() => undefined);
    } else {
      element.pause();
      if (!active) element.currentTime = 0;
    }
  }, [active, inView]);

  const togglePlay = useCallback(() => {
    const element = video.current;
    if (!element) return;
    if (element.paused) void element.play();
    else element.pause();
  }, []);

  const handlePlay = useCallback((event: MouseEvent) => {
    event.stopPropagation();
    togglePlay();
  }, [togglePlay]);

  // Fullscreen hands playback, sound, and seeking to the device's native player.
  const openFullscreen = useCallback(
    (event: MouseEvent) => {
      event.stopPropagation();
      const element = video.current as FullscreenVideo | null;
      if (!element) return;
      if (!active) onActivate(index);
      element.controls = true;
      void element.play().catch(() => undefined);
      const hideControls = () => {
        if (document.fullscreenElement === element) return;
        element.controls = false;
        document.removeEventListener("fullscreenchange", hideControls);
      };
      element.addEventListener("webkitendfullscreen", () => { element.controls = false; }, { once: true });
      if (element.requestFullscreen) {
        document.addEventListener("fullscreenchange", hideControls);
        element.requestFullscreen().catch(() => element.webkitEnterFullscreen?.());
      } else {
        element.webkitEnterFullscreen?.();
      }
    },
    [active, index, onActivate],
  );

  return (
    <article
      ref={card}
      className={`reel-card reel-${item.orientation ?? "portrait"} ${active ? "reel-active" : ""}`}
      data-index={index}
    >
      <div className="reel-media-shell">
        <span className="reel-progress" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </span>
        <span className="reel-frame-counter" aria-hidden="true">
          {String(index + 1).padStart(2, "0")}{active && ` / ${String(total).padStart(2, "0")}`}
        </span>
        <video
          ref={video}
          muted
          loop
          playsInline
          preload="none"
          poster={item.poster}
          aria-label={item.title}
          onTimeUpdate={(event) => {
            const target = event.currentTarget;
            if (target.duration) setProgress((target.currentTime / target.duration) * 100);
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        >
          <source src={item.video} type="video/mp4" />
        </video>
        {!active && (
          <button
            type="button"
            className="reel-media-action"
            onClick={() => onActivate(index)}
            aria-label={`Show ${item.title}`}
          />
        )}
        {active && (
          <button
            type="button"
            className={`reel-play-button ${playing ? "is-playing" : ""}`}
            onClick={handlePlay}
            aria-label={playing ? `Pause ${item.title}` : `Play ${item.title}`}
          >
            {playing ? <Pause size={22} /> : <Play size={22} />}
          </button>
        )}
        {active && playing && (
          <button
            type="button"
            className="reel-fullscreen-button"
            onClick={openFullscreen}
            aria-label={`Watch ${item.title} fullscreen`}
          >
            <Maximize size={15} />
          </button>
        )}
      </div>
      <div className="reel-caption">
        {active && <span className="reel-category">{category}</span>}
        <h2>{item.title}</h2>
        <div className="reel-caption-foot">
          <span className="reel-tag">{active ? descriptor : item.tag}</span>
          {item.secondaryHref && (
            <Link
              className="reel-secondary"
              href={item.secondaryHref}
              onClick={(event) => {
                if (!active) event.preventDefault();
              }}
            >
              {item.secondaryLabel ?? "View case study"} <ArrowUpRight size={14} />
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

export function VideoReelRail({
  items,
  label,
  category,
  descriptor,
  initialIndex = 0,
}: {
  items: ReelItem[];
  label: string;
  category: string;
  descriptor: string;
  initialIndex?: number;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, moved: false, startX: 0, startScroll: 0 });
  const programmaticTarget = useRef<number | null>(null);
  const programmaticTimer = useRef<number | null>(null);
  const programmaticFrame = useRef<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, Math.min(items.length - 1, initialIndex)));

  useEffect(() => {
    const container = rail.current;
    if (!container) return;
    let frame = 0;
    const updateActive = () => {
      if (programmaticTarget.current !== null) return;
      const cards = Array.from(container.querySelectorAll<HTMLElement>(".reel-card"));
      const containerCenter = container.getBoundingClientRect().left + container.clientWidth / 2;
      let closest = 0;
      let closestDistance = Infinity;
      cards.forEach((card, index) => {
        const rect = card.getBoundingClientRect();
        const distance = Math.abs(rect.left + rect.width / 2 - containerCenter);
        if (distance < closestDistance) {
          closestDistance = distance;
          closest = index;
        }
      });
      setActiveIndex(closest);
    };
    let scrollSettleTimer = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(scrollSettleTimer);
      scrollSettleTimer = window.setTimeout(() => {
        frame = requestAnimationFrame(updateActive);
      }, 100);
    };
    const initialFrame = requestAnimationFrame(() => {
      const target = container.querySelectorAll<HTMLElement>(".reel-card")[initialIndex];
      if (target) container.scrollLeft = target.offsetLeft - (container.clientWidth - target.offsetWidth) / 2;
      updateActive();
    });
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", onScroll);
      window.clearTimeout(scrollSettleTimer);
      cancelAnimationFrame(initialFrame);
      cancelAnimationFrame(frame);
    };
  }, [initialIndex]);

  // Tint the surrounding format stage with the active film's colors, refreshed as the film plays.
  useEffect(() => {
    const container = rail.current;
    const stage = container?.closest<HTMLElement>(".format-stage");
    const card = container?.querySelectorAll<HTMLElement>(".reel-card")[activeIndex];
    const video = card?.querySelector("video");
    if (!stage || !video) return;
    const apply = (colors: readonly [string, string] | null) => {
      if (!colors) return;
      stage.style.setProperty("--stage-a", colors[0]);
      stage.style.setProperty("--stage-b", colors[1]);
    };
    const sample = () => {
      if (video.readyState >= 2 && !video.paused) apply(sampleStageColors(video));
    };
    if (video.poster) {
      const poster = new window.Image();
      poster.onload = () => { if (video.readyState < 2 || video.paused) apply(sampleStageColors(poster)); };
      poster.src = video.poster;
    }
    const timer = window.setInterval(sample, 2200);
    video.addEventListener("playing", sample);
    return () => {
      window.clearInterval(timer);
      video.removeEventListener("playing", sample);
    };
  }, [activeIndex]);

  const scrollToIndex = useCallback(
    (index: number) => {
      const container = rail.current;
      if (!container) return;
      const clamped = Math.max(0, Math.min(items.length - 1, index));
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      programmaticTarget.current = clamped;
      setActiveIndex(clamped);
      if (programmaticTimer.current !== null) window.clearTimeout(programmaticTimer.current);
      if (programmaticFrame.current !== null) cancelAnimationFrame(programmaticFrame.current);
      programmaticFrame.current = requestAnimationFrame(() => {
        programmaticFrame.current = requestAnimationFrame(() => {
          const target = container.querySelectorAll<HTMLElement>(".reel-card")[clamped];
          if (!target) return;
          const centerTarget = () => target.offsetLeft - (container.clientWidth - target.offsetWidth) / 2;
          container.scrollTo({ left: centerTarget(), behavior: reducedMotion ? "auto" : "smooth" });
          programmaticTimer.current = window.setTimeout(() => {
            container.scrollLeft = centerTarget();
            programmaticTarget.current = null;
            programmaticTimer.current = null;
            programmaticFrame.current = null;
          }, reducedMotion ? 0 : 650);
        });
      });
    },
    [items.length],
  );

  useEffect(() => () => {
    if (programmaticTimer.current !== null) window.clearTimeout(programmaticTimer.current);
    if (programmaticFrame.current !== null) cancelAnimationFrame(programmaticFrame.current);
  }, []);

  const onPointerDown = useCallback((event: PointerEvent) => {
    if (event.pointerType === "touch") return;
    const container = rail.current;
    if (!container) return;
    drag.current = { active: true, moved: false, startX: event.clientX, startScroll: container.scrollLeft };
  }, []);

  const onPointerMove = useCallback((event: PointerEvent) => {
    if (event.pointerType === "touch") return;
    const container = rail.current;
    if (!container || !drag.current.active) return;
    const delta = event.clientX - drag.current.startX;
    if (Math.abs(delta) > 4) drag.current.moved = true;
    container.scrollLeft = drag.current.startScroll - delta;
  }, []);

  const onPointerUp = useCallback(() => {
    drag.current.active = false;
  }, []);

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    scrollToIndex(activeIndex + (event.key === "ArrowRight" ? 1 : -1));
  }, [activeIndex, scrollToIndex]);

  if (items.length === 0) return null;
  const single = items.length === 1;

  return (
    <>
      {!single && <div className="reel-head">
        <p className="eyebrow">Swipe or drag through the work</p>
        <div className="reel-nav">
          <button type="button" onClick={() => scrollToIndex(activeIndex - 1)} disabled={activeIndex === 0} aria-label="Previous project">
            <ArrowLeft size={18} />
          </button>
          <span>
            {String(activeIndex + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}
          </span>
          <button
            type="button"
            onClick={() => scrollToIndex(activeIndex + 1)}
            disabled={activeIndex === items.length - 1}
            aria-label="Next project"
          >
            <ArrowRight size={18} />
          </button>
        </div>
      </div>}

      <div
        className={single ? "reel-rail reel-single" : "reel-rail"}
        ref={rail}
        tabIndex={0}
        aria-label={`${label}. Use left and right arrow keys to browse.`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        data-lenis-prevent-horizontal
      >
        {items.map((item, index) => (
          <ReelCard
            key={item.key}
            item={item}
            index={index}
            total={items.length}
            active={index === activeIndex}
            category={category}
            descriptor={descriptor}
            onActivate={(target) => {
              if (drag.current.moved) return;
              scrollToIndex(target);
            }}
          />
        ))}
      </div>

      {!single && <div className="reel-filmstrip" role="tablist" aria-label={label}>
        {items.map((item, index) => (
          <button
            key={item.key}
            type="button"
            className={index === activeIndex ? "active" : ""}
            onClick={() => scrollToIndex(index)}
            aria-label={`Go to ${item.title}`}
            aria-selected={index === activeIndex}
            role="tab"
          >
            <span className="reel-filmstrip-image">
              <Image src={item.poster} alt="" fill sizes="120px" />
            </span>
            <span className="reel-filmstrip-number">{String(index + 1).padStart(2, "0")}</span>
          </button>
        ))}
      </div>}
    </>
  );
}
