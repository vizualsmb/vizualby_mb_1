"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import type { PointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CinematicPreview } from "./CinematicPreview";

export type FormatCategory = {
  index: string;
  label: string;
  title: string;
  description: string;
  href: string;
  video: string;
  poster: string;
};

export function FormatRail({ categories }: { categories: FormatCategory[] }) {
  const rail = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, moved: false, startX: 0, startScroll: 0 });
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const container = rail.current;
    if (!container) return;
    let frame = 0;
    const updateActive = () => {
      const cards = Array.from(container.querySelectorAll<HTMLElement>(".format-card"));
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
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateActive);
    };
    updateActive();
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  const scrollToIndex = useCallback(
    (index: number) => {
      const container = rail.current;
      if (!container) return;
      const clamped = Math.max(0, Math.min(categories.length - 1, index));
      container.querySelectorAll<HTMLElement>(".format-card")[clamped]?.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    },
    [categories.length],
  );

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

  const guardDrag = useCallback((event: { preventDefault: () => void }) => {
    if (drag.current.moved) event.preventDefault();
  }, []);

  return (
    <>
      <div className="format-nav">
        <button type="button" onClick={() => scrollToIndex(activeIndex - 1)} disabled={activeIndex === 0} aria-label="Previous format">
          <ArrowLeft size={18} />
        </button>
        <span>
          {String(activeIndex + 1).padStart(2, "0")} / {String(categories.length).padStart(2, "0")}
        </span>
        <button
          type="button"
          onClick={() => scrollToIndex(activeIndex + 1)}
          disabled={activeIndex === categories.length - 1}
          aria-label="Next format"
        >
          <ArrowRight size={18} />
        </button>
      </div>

      <div
        className="format-rail"
        ref={rail}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onPointerCancel={onPointerUp}
        data-lenis-prevent-horizontal
      >
        {categories.map((category, index) => {
          const active = index === activeIndex;
          return (
            <article className={`format-card ${active ? "format-active" : ""}`} key={category.href} data-index={index}>
              <Link className="format-media" href={category.href} onClick={guardDrag} aria-label={`View ${category.title} projects`}>
                <CinematicPreview src={category.video} poster={category.poster} />
              </Link>
              <span className="format-index">{category.index}</span>
              <div className="format-copy">
                <span className="format-label">{category.label}</span>
                <h2>{category.title}</h2>
                <p>{category.description}</p>
                <Link className="format-link" href={category.href} onClick={guardDrag}>
                  Explore <ArrowUpRight size={16} />
                </Link>
              </div>
            </article>
          );
        })}
      </div>

      <div className="format-dots" role="tablist" aria-label="Select format">
        {categories.map((category, index) => (
          <button
            key={category.href}
            type="button"
            className={index === activeIndex ? "active" : ""}
            onClick={() => scrollToIndex(index)}
            aria-label={`Go to ${category.title}`}
            aria-selected={index === activeIndex}
            role="tab"
          />
        ))}
      </div>
    </>
  );
}
