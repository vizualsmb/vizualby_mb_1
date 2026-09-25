import type { Metadata } from "next";

// Page segments replace the root openGraph/twitter objects wholesale, so build them fully here.
export function pageMetadata({ title, description, path, image }: { title: string; description: string; path: string; image: string }): Metadata {
  const socialTitle = `${title} — VIZUAL BY MB`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", title: socialTitle, description, url: path, images: [{ url: image }] },
    twitter: { card: "summary_large_image", title: socialTitle, description, images: [image] },
  };
}
