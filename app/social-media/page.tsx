import type { Metadata } from "next";
import { pageMetadata } from "@/lib/metadata";
import { SocialMediaPage } from "@/components/SocialMediaPage";

export const metadata: Metadata = pageMetadata({
  title: "Social Media",
  description: "Short-form social media films by VIZUAL BY MB.",
  path: "/social-media",
  image: "/images/social-media/andy-promo.webp",
});

export default function Page() {
  return <SocialMediaPage />;
}
