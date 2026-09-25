import type { Metadata } from "next";
import { pageMetadata } from "@/lib/metadata";
import { BrandingPage } from "@/components/BrandingPage";

export const metadata: Metadata = pageMetadata({
  title: "Branding",
  description: "Brand films and campaign visuals by VIZUAL BY MB.",
  path: "/branding",
  image: "/images/branding/blind.webp",
});

export default function Page() {
  return <BrandingPage />;
}
