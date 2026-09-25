"use client";

import { useEffect, useRef } from "react";

export function CustomCursor() {
  const cursor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    document.documentElement.classList.add("has-custom-cursor");
    const move = (event: MouseEvent) => {
      if (!cursor.current) return;
      cursor.current.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
    };
    const over = (event: MouseEvent) => cursor.current?.classList.toggle("active", Boolean((event.target as HTMLElement).closest("a,button")));
    window.addEventListener("mousemove", move);
    document.addEventListener("mouseover", over);
    return () => {
      document.documentElement.classList.remove("has-custom-cursor");
      window.removeEventListener("mousemove", move);
      document.removeEventListener("mouseover", over);
    };
  }, []);
  return <div className="cursor" ref={cursor} aria-hidden="true" />;
}
