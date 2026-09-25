"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { site } from "@/data/site";

export function Header() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const triggerElement = trigger.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab" || !dialog.current) return;
      const focusable = Array.from(dialog.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      triggerElement?.focus();
    };
  }, [open]);

  return (
    <>
      <header className="header">
        <Link className="brand" href="/" aria-label="VIZUAL BY MB home">
          <Image src="/logo/mb-white.png" alt="" width={600} height={533} priority />
          <span>VIZUAL BY MB</span>
        </Link>
        <button ref={trigger} className="menu-button" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} aria-haspopup="dialog">
          <span>Menu</span><Menu size={19} strokeWidth={1.5} />
        </button>
      </header>
      <AnimatePresence>
        {open && (
          <motion.div ref={dialog} className="menu-overlay" role="dialog" aria-modal="true" aria-label="Main menu" initial={{ y: "-100%" }} animate={{ y: 0 }} exit={{ y: "-100%" }} transition={{ duration: 0.65, ease: [0.76, 0, 0.24, 1] }}>
            <div className="menu-top">
              <span>VIZUAL BY MB</span>
              <button ref={closeButton} onClick={close} aria-label="Close menu"><X size={24} strokeWidth={1.4} /></button>
            </div>
            <nav aria-label="Primary navigation">
              {[['Work', '/#work'], ['About', '/#about'], ['Services', '/#services'], ['Contact', '/#contact']].map(([label, href], index) => (
                <motion.a key={label} href={href} onClick={close} initial={{ y: 70, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.18 + index * 0.08 }}>
                  <span>0{index + 1}</span>{label}
                </motion.a>
              ))}
            </nav>
            <div className="menu-foot">
              <a href={`mailto:${site.email}`}>{site.email}</a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
