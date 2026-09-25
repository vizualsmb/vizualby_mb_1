import type { Metadata } from "next";
import { pageMetadata } from "@/lib/metadata";
import { ShortFilmsPage } from "@/components/ShortFilmsPage";

export const metadata: Metadata = pageMetadata({
  title: "Short Films",
  description: "Narrative short films directed by VIZUAL BY MB.",
  path: "/short-films",
  image: "/images/short-films/streamer-university.webp",
});

export default function Page() {
  return <ShortFilmsPage />;
}
