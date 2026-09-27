"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useCallback, useRef, useState } from "react";

type FullscreenVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

export type GridItem = {
  key: string;
  title: string;
  video: string;
  poster: string;
  tag: string;
  orientation: "landscape" | "portrait";
  secondaryHref?: string;
  secondaryLabel?: string;
};

// Tile spans are chosen by how many films there are, so a page with one or two
// projects gets full, deliberate tiles instead of a mosaic with mostly empty cells.
function getSpan(orientation: GridItem["orientation"], total: number, uniform: boolean) {
  if (total <= 1) return { col: 6, row: 5 };
  if (total === 2) return { col: 3, row: 5 };
  if (total === 4 && uniform) return { col: 3, row: 3 };
  return orientation === "landscape" ? { col: 3, row: 2 } : { col: 2, row: 3 };
}

function Tile({ item, span }: { item: GridItem; span: { col: number; row: number } }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  const play = useCallback(() => {
    const element = videoRef.current;
    if (!element) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    void element.play().catch(() => undefined);
  }, []);

  const stop = useCallback(() => {
    const element = videoRef.current;
    if (!element) return;
    element.pause();
    element.currentTime = 0;
  }, []);

  const openFullscreen = useCallback(() => {
    const element = videoRef.current as FullscreenVideo | null;
    if (!element) return;
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
  }, []);

  return (
    <div
      className={`media-tile media-tile-${item.orientation}`}
      style={{ gridColumn: `span ${span.col}`, gridRow: `span ${span.row}` }}
    >
      <button
        type="button"
        className="media-tile-play"
        onMouseEnter={play}
        onMouseLeave={stop}
        onFocus={play}
        onBlur={stop}
        onClick={openFullscreen}
        aria-label={`Play ${item.title} with sound`}
      >
        <video
          ref={videoRef}
          muted
          loop
          playsInline
          preload="metadata"
          poster={item.poster}
          aria-hidden="true"
          tabIndex={-1}
          onLoadedMetadata={(event) => {
            const total = event.currentTarget.duration;
            if (Number.isFinite(total)) {
              const minutes = Math.floor(total / 60);
              const seconds = Math.round(total % 60).toString().padStart(2, "0");
              setDuration(`${minutes}:${seconds}`);
            }
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        >
          <source src={item.video} type="video/mp4" />
        </video>
        <span className="media-tile-scrim" aria-hidden="true" />
        {duration && (
          <span className="media-tile-duration">
            <span className={`media-tile-dot ${playing ? "is-live" : ""}`} aria-hidden="true" />
            {duration}
          </span>
        )}
      </button>
      <span className="media-tile-caption">
        <span className="media-tile-tag">{item.tag}</span>
        <span className="media-tile-title">{item.title}</span>
        {item.secondaryHref && (
          <Link
            className="media-tile-secondary"
            href={item.secondaryHref}
            onClick={(event) => event.stopPropagation()}
          >
            {item.secondaryLabel ?? "View case study"} <ArrowUpRight size={13} />
          </Link>
        )}
      </span>
    </div>
  );
}

export function MediaGrid({ items }: { items: GridItem[] }) {
  const uniform = items.every((item) => item.orientation === items[0]?.orientation);
  return (
    <div className="media-grid">
      {items.map((item) => (
        <Tile key={item.key} item={item} span={getSpan(item.orientation, items.length, uniform)} />
      ))}
    </div>
  );
}
