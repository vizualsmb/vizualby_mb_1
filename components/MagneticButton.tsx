"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useRef } from "react";

export function MagneticButton({ href, children }: { href: string; children: React.ReactNode }) {
  const ref = useRef<HTMLAnchorElement>(null);
  return (
    <Link
      ref={ref}
      className="magnetic"
      href={href}
      onMouseMove={(event) => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect || !ref.current) return;
        ref.current.style.transform = `translate(${(event.clientX - rect.left - rect.width / 2) * 0.12}px, ${(event.clientY - rect.top - rect.height / 2) * 0.12}px)`;
      }}
      onMouseLeave={() => { if (ref.current) ref.current.style.transform = "translate(0, 0)"; }}
    >
      {children}<ArrowUpRight size={18} strokeWidth={1.4} />
    </Link>
  );
}
