export const site = {
  name: "VIZUAL BY MB",
  shortName: "MB",
  email: "hello@vizualbymb.com",
  location: "Based in MA + RD / Available worldwide",
  availability: "Available for select projects",
  socials: [
    { platform: "instagram", label: "Instagram @vizualbymb", href: "https://www.instagram.com/vizualbymb/" },
    { platform: "youtube", label: "YouTube", href: "https://www.youtube.com/@vizualby_mb" },
  ] as { platform: "instagram" | "youtube"; label: string; href: string }[],
};

export const services = [
  { title: "Creative Direction", detail: "Concepts / treatments" },
  { title: "Video Production", detail: "Music / events / campaigns" },
  { title: "Cinematography", detail: "Camera / lighting" },
  { title: "Editing & Post", detail: "Edit / color / delivery" },
  { title: "Social Content", detail: "Short-form / vertical" },
];
