"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function CinematicPreview({
  src,
  poster,
  className,
  priority = false,
  active = true,
  highQualitySrc,
  fallback,
}: {
  src: string;
  poster: string;
  className?: string;
  priority?: boolean;
  active?: boolean;
  highQualitySrc?: string;
  // Shown in place of the video (and its poster frame) if every source fails to load.
  fallback?: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const inView = useRef(priority);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [errored, setErrored] = useState(false);

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

    const resume = () => { clearStallTimer(); playIfAllowed(); };
    const resumeVisible = () => {
      if (document.visibilityState === "visible") playIfAllowed();
    };
    // All sources failed (bad network, blocked request, unsupported codec): fall back instead
    // of leaving a broken video element or a frozen poster frame on screen.
    const showFallback = () => { if (fallback) setErrored(true); };
    // A real decode/network error fires "error" with networkState NETWORK_NO_SOURCE (3). Some
    // browsers reach that same stuck state (readyState 0, no data ever arriving) without ever
    // dispatching "error" — e.g. a request that's silently blocked or aborted. The timer below
    // catches that case; it's cleared as soon as data actually starts arriving.
    const stallTimer: ReturnType<typeof setTimeout> = setTimeout(() => { if (element.readyState === 0) showFallback(); }, 8000);
    function clearStallTimer() { clearTimeout(stallTimer); }

    element.addEventListener("loadeddata", resume);
    element.addEventListener("canplay", resume);
    element.addEventListener("error", showFallback);
    window.addEventListener("pageshow", resume);
    document.addEventListener("visibilitychange", resumeVisible);
    element.load();
    playIfAllowed();

    return () => {
      clearStallTimer();
      element.removeEventListener("loadeddata", resume);
      element.removeEventListener("canplay", resume);
      element.removeEventListener("error", showFallback);
      window.removeEventListener("pageshow", resume);
      document.removeEventListener("visibilitychange", resumeVisible);
    };
  }, [playIfAllowed, shouldLoad, fallback]);

  if (errored && fallback) {
    return (
      <div className={className} aria-hidden="true" style={{ display: "grid", placeItems: "center", background: "var(--ink)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- fixed logo mark, not an optimized content image */}
        <img src={fallback} alt="" style={{ width: "16%", minWidth: 72, maxWidth: 160, height: "auto", objectFit: "contain" }} />
      </div>
    );
  }

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
