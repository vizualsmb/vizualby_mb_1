import type { Metadata } from "next";
import { pageMetadata } from "@/lib/metadata";
import { AftermoviesPage } from "@/components/AftermoviesPage";

export const metadata: Metadata = pageMetadata({
  title: "Aftermovies",
  description: "Cinematic event aftermovies by VIZUAL BY MB.",
  path: "/aftermovies",
  image: "/images/aftermovies/saii-2.webp",
});

export default function Page() {
  return <AftermoviesPage />;
}
