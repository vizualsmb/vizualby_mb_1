"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function CinematicPreview({
  src,
  poster,
  className,
  priority = false,
  active = true,
  highQualitySrc,
}: {
  src: string;
  poster: string;
  className?: string;
  priority?: boolean;
  active?: boolean;
  highQualitySrc?: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const inView = useRef(priority);
  const [shouldLoad, setShouldLoad] = useState(false);

  const playIfAllowed = useCallback(() => {
    const element = video.current;
    if (!element || !active || !inView.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    element.muted = true;
    element.defaultMuted = true;
    void element.play().catch(() => undefined);
  }, [active]);

  useEffect(() => {
    const element = video.current;
    if (!element) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches) {
      element.pause();
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        inView.current = entry.isIntersecting;
        if (entry.isIntersecting) {
          setShouldLoad(true);
          if (element.readyState >= 2) playIfAllowed();
        } else {
          element.pause();
        }
      },
      { rootMargin: "0px" },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [playIfAllowed]);

  useEffect(() => {
    const element = video.current;
    if (!element || !shouldLoad) return;

    const resume = () => playIfAllowed();
    const resumeVisible = () => {
      if (document.visibilityState === "visible") playIfAllowed();
    };

    element.addEventListener("loadeddata", resume);
    element.addEventListener("canplay", resume);
    window.addEventListener("pageshow", resume);
    document.addEventListener("visibilitychange", resumeVisible);
    element.load();
    playIfAllowed();

    return () => {
      element.removeEventListener("loadeddata", resume);
      element.removeEventListener("canplay", resume);
      window.removeEventListener("pageshow", resume);
      document.removeEventListener("visibilitychange", resumeVisible);
    };
  }, [playIfAllowed, shouldLoad]);

  return (
    <video
      ref={video}
      className={className}
      muted
      loop
      playsInline
      preload={shouldLoad ? "metadata" : "none"}
      poster={poster}
      aria-hidden="true"
    >
      {shouldLoad && highQualitySrc && <source src={highQualitySrc} type='video/mp4; codecs="hvc1"' />}
      {shouldLoad && <source src={src} type="video/mp4" />}
    </video>
  );
}
