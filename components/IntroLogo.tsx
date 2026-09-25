"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import gsap from "gsap";

export function IntroLogo({ onComplete }: { onComplete: () => void }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      onComplete();
      return;
    }
    const ctx = gsap.context(() => {
      const timeline = gsap.timeline({ onComplete });
      timeline
        .set(".intro-mark", { clipPath: "inset(0 100% 0 0)" })
        .to(".intro-mark", { clipPath: "inset(0 48% 0 0)", duration: 0.85, ease: "power3.inOut" })
        .to(".intro-mark", { clipPath: "inset(0 0% 0 0)", duration: 0.8, ease: "power3.inOut" }, "+=0.12")
        .to(".intro-rule", { scaleX: 1, duration: 0.6, ease: "expo.out" }, "-=0.25")
        .to(root.current, { yPercent: -100, duration: 0.9, ease: "power4.inOut" }, "+=0.45");
    }, root);
    return () => ctx.revert();
  }, [onComplete]);

  return (
    <div className="intro" ref={root} aria-hidden="true">
      <div className="intro-mark">
        <Image src="/logo/mb-white.png" alt="" width={600} height={533} priority />
      </div>
      <span className="intro-rule" />
      <p>Independent creative studio</p>
    </div>
  );
}
