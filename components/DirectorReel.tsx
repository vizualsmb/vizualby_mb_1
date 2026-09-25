"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize, Pause, Play, Volume2, VolumeX } from "lucide-react";

const VIDEO_ID = "director-reel-video";

type FullscreenVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

// Opens the behind-the-scenes clip fullscreen with sound. iPhone Safari only supports webkitEnterFullscreen on video.
export function openDirectorReel({ restart = true }: { restart?: boolean } = {}) {
  const video = document.getElementById(VIDEO_ID) as FullscreenVideo | null;
  if (!video) return;
  if (restart) video.currentTime = 0;
  video.muted = false;
  void video.play();
  if (video.requestFullscreen) video.requestFullscreen().catch(() => video.webkitEnterFullscreen?.());
  else video.webkitEnterFullscreen?.();
}

function formatTime(seconds: number) {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function DirectorReel() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [duration, setDuration] = useState<number | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (
      !video ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      window.matchMedia("(pointer: coarse)").matches
    ) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void video.play().catch(() => undefined);
        else video.pause();
      },
      { threshold: 0.35 },
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  };

  const toggleSound = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  };

  return (
    <div className="director-reel">
      <video
        ref={videoRef}
        id={VIDEO_ID}
        src="/video/about/directing-bts.mp4"
        poster="/images/about/directing-bts-bw.webp"
        loop
        muted
        playsInline
        preload="none"
        aria-label="Behind the scenes footage of MB directing on set"
        onClick={togglePlayback}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onVolumeChange={(event) => setMuted(event.currentTarget.muted)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
      />
      <div className="director-reel-top">
        <div>
          <span className="director-reel-live"><i aria-hidden="true" />Behind the scenes</span>
          <span className="director-reel-sub">On set / 2025</span>
        </div>
        <ul className="director-reel-tags"><li>Film</li><li>Direction</li><li>Creative</li></ul>
      </div>
      <div className="director-reel-bottom">
        {duration ? <span className="director-reel-time">{formatTime(duration)}</span> : <span />}
        <div className="director-reel-controls">
          <button type="button" onClick={togglePlayback} aria-label={playing ? "Pause behind the scenes video" : "Play behind the scenes video"}>
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button type="button" onClick={toggleSound} aria-label={muted ? "Turn on video sound" : "Mute video sound"}>
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <button type="button" onClick={() => openDirectorReel({ restart: false })} aria-label="Watch behind the scenes video fullscreen">
            <Maximize size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
