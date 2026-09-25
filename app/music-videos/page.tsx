import type { Metadata } from "next";
import { pageMetadata } from "@/lib/metadata";
import { MusicVideosPage } from "@/components/MusicVideosPage";

export const metadata: Metadata = pageMetadata({
  title: "Music Videos",
  description: "Music videos and performance films by VIZUAL BY MB.",
  path: "/music-videos",
  image: "/images/medomina-1.webp",
});

export default function Page() {
  return <MusicVideosPage />;
}
