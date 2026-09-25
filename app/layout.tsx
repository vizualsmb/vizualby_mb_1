import type { Metadata, Viewport } from "next";
import { Archivo_Narrow } from "next/font/google";
import "./globals.css";

const displayFont = Archivo_Narrow({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "VIZUAL BY MB", template: "%s — VIZUAL BY MB" },
  description: "Cinematic direction, filmmaking, cinematography, and social content by VIZUAL BY MB.",
  metadataBase: new URL("https://vizualbymb.com"),
  alternates: { canonical: "/" },
  keywords: ["filmmaker", "director", "cinematographer", "music videos", "aftermovies", "video production"],
  creator: "VIZUAL BY MB",
  icons: { icon: "/icon.png", apple: "/icon.png" },
  openGraph: {
    type: "website",
    url: "/",
    title: "VIZUAL BY MB",
    description: "Cinematic films, campaigns, and social stories shaped from concept through final frame.",
    images: [{ url: "/opengraph-image.jpg?v=4", width: 1200, height: 630, alt: "VIZUAL BY MB logo — Filmmaker" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "VIZUAL BY MB",
    description: "Cinematic films, campaigns, and social stories shaped from concept through final frame.",
    images: ["/opengraph-image.jpg?v=4"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={displayFont.variable} data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "ProfessionalService",
              name: "VIZUAL BY MB",
              url: "https://vizualbymb.com",
              email: "hello@vizualbymb.com",
              areaServed: ["Massachusetts", "Dominican Republic", "Worldwide"],
              serviceType: ["Creative Direction", "Video Production", "Cinematography", "Post Production"],
              sameAs: [
                "https://www.instagram.com/vizualbymb/",
                "https://www.youtube.com/@vizualby_mb",
              ],
            }),
          }}
        />
      </body>
    </html>
  );
}
