import Image from "next/image";
import Link from "next/link";
import { ArrowUp, Instagram, Mail, Youtube } from "lucide-react";
import { site } from "@/data/site";

const socialIcons = { instagram: Instagram, youtube: Youtube };

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-top">
        <Link href="/#top" className="footer-brand" aria-label="VIZUAL BY MB home">
          <Image src="/logo/mb-white.png" alt="" width={600} height={533} />
        </Link>
        <p className="footer-tagline">Director &amp; filmmaker. From concept to final frame.</p>
      </div>
      <div className="footer-cols">
        <div>
          <h2>Connect</h2>
          <div className="footer-social-icons">
            <a href={`mailto:${site.email}`} aria-label="Email">
              <Mail size={19} strokeWidth={1.5} aria-hidden="true" />
            </a>
            {site.socials.map((social) => {
              const Icon = socialIcons[social.platform];
              return (
                <a key={social.href} href={social.href} target="_blank" rel="noreferrer" aria-label={social.label}>
                  <Icon size={19} strokeWidth={1.5} aria-hidden="true" />
                </a>
              );
            })}
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <p>© {new Date().getFullYear()} VIZUAL BY MB</p>
        <Link href="/privacy">Privacy</Link>
        <a href="#main-content" className="footer-top-link">Back to top<ArrowUp size={13} strokeWidth={1.5} aria-hidden="true" /></a>
      </div>
    </footer>
  );
}
