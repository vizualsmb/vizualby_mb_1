export type Project = {
  slug: string;
  title: string;
  category: string;
  year: string;
  image: string;
  video?: string;
  videoPreview?: string;
  orientation: "landscape" | "portrait";
  gallery?: string[];
  accent: string;
  intro: string;
  challenge: string;
  approach: string;
  result: string;
  details: { label: string; value: string }[];
  services: string[];
  serviceDetails: { title: string; description: string }[];
};

export const projects: Project[] = [
  {
    slug: "elliott-santini-me-domina",
    title: "Elliott Santini - ME DOMINA",
    category: "Music video / Visual direction",
    year: "2026",
    image: "/images/medomina-1.webp",
    video: "/video/elliott-santini-medomina.mp4",
    videoPreview: "/video/elliott-santini-medomina-preview.mp4",
    orientation: "landscape",
    gallery: [
      "/images/medomina-2.webp",
      "/images/medomina-3.webp",
      "/images/medomina-4.webp",
      "/images/medomina-5.webp",
      "/images/medomina-6.webp",
      "/images/medomina-7.webp",
    ],
    accent: "#087fa5",
    intro: "A vivid visual world for Elliott Santini's ME DOMINA, shaped around movement, attitude, and the energy of a shared night out.",
    challenge: "Turn the track's social energy into images that feel immediate and spontaneous while remaining composed frame by frame.",
    approach: "Low angles, direct portraiture, saturated sky blue, and close physical proximity place the viewer inside the crowd rather than outside the action.",
    result: "A character-led music video and image series that carries the track's social energy through every frame.",
    details: [
      { label: "Artist", value: "Elliott Santini" },
      { label: "Format", value: "Music video" },
      { label: "Runtime", value: "2:18" },
      { label: "Delivery", value: "Film / campaign stills" },
    ],
    services: ["Visual direction", "Cinematography", "Editing", "Sound design", "Color grading"],
    serviceDetails: [
      { title: "Visual direction", description: "Built the visual language around movement, attitude, and the collective energy of the track." },
      { title: "Cinematography", description: "Used intimate framing, low angles, and saturated color to place the audience inside the celebration." },
      { title: "Editing", description: "Shaped performance, crowd energy, and visual transitions around the rhythm and structure of the track." },
      { title: "Sound design", description: "Layered environmental texture and transitions around the music to make the visual world feel physical and immediate." },
      { title: "Color grading", description: "Balanced deep skin tones, electric blues, and warm highlights into a vivid, cohesive music-video finish." },
    ],
  },
  {
    slug: "gym-basketball",
    title: "GYM / Basketball",
    category: "Fitness campaign / Sports film",
    year: "2026",
    image: "/images/social-media/andy-promo.webp",
    video: "/video/social-media/Work.mp4",
    videoPreview: "/video/social-media/andy-the-work-preview.mp4",
    orientation: "portrait",
    gallery: [
      "/images/andy-the-work-1.webp",
      "/images/andy-the-work-2.webp",
      "/images/andy-the-work-3.webp",
    ],
    accent: "#68715f",
    intro: "A visceral training portrait of Anderson Correia, the Cape Verdean professional shooting guard, focused on the repetition and physical discipline behind elite performance.",
    challenge: "Move beyond the public image of a national-team athlete and reveal the private work that sustains Anderson Correia's performance on the court.",
    approach: "Tight framing, softened motion, sweat, and a restrained gym palette bring the camera close to Correia's 1.95-metre frame and make every repetition tactile.",
    result: "A focused vertical sports film that presents a Cape Verde international through discipline, physical detail, and the intensity of an uninterrupted training session.",
    details: [
      { label: "Athlete", value: "Anderson Correia" },
      { label: "Nationality", value: "Cape Verdean" },
      { label: "Position", value: "Shooting guard" },
      { label: "Height", value: "1.95 m / 6 ft 5 in" },
      { label: "Format", value: "Vertical sports film" },
      { label: "Runtime", value: "0:42" },
    ],
    services: ["Creative direction", "Cinematography", "Social edit", "Sound design", "Color grading"],
    serviceDetails: [
      { title: "Creative direction", description: "Developed a performance concept around the discipline and repetition behind Correia's career as an international shooting guard." },
      { title: "Cinematography", description: "Designed vertical compositions, close body details, and controlled movement around the scale and physicality of a 1.95-metre athlete." },
      { title: "Social edit", description: "Cut the film for mobile viewing with fast visual hooks, tactile sound, and pacing shaped for short-form attention." },
      { title: "Sound design", description: "Built impact from breath, movement, equipment, and room tone so the workout feels as physical as it looks." },
      { title: "Color grading", description: "Refined the restrained gym palette, skin detail, and highlight rolloff while preserving the film's raw texture." },
    ],
  },
  {
    slug: "fast-and-furious",
    title: "Fast & Furious",
    category: "Automotive film / Night culture",
    year: "2026",
    image: "/images/feith.webp",
    video: "/video/feith.mp4",
    videoPreview: "/video/feith-preview.mp4",
    orientation: "landscape",
    accent: "#a92b1f",
    intro: "A charged night film built around cars, crowds, smoke, and the raw energy of a scene gathering after dark.",
    challenge: "Capture live automotive action without sanding away the immediacy that makes the gathering feel electric.",
    approach: "Available light, headlamps, hard flashes, and close handheld perspectives turn the location into a restless visual field.",
    result: "A fast, atmospheric film that puts the viewer inside the circle and lets motion shape the edit.",
    details: [
      { label: "Format", value: "Automotive film" },
      { label: "Runtime", value: "1:28" },
      { label: "Setting", value: "Night culture" },
      { label: "Delivery", value: "Film / social cut" },
    ],
    services: ["Film direction", "Cinematography", "Editing", "Sound design", "Color grading"],
    serviceDetails: [
      { title: "Film direction", description: "Structured the live energy of the gathering into a clear visual journey without losing its spontaneity." },
      { title: "Cinematography", description: "Combined handheld proximity, available light, and hard flashes to capture the atmosphere from inside the action." },
      { title: "Editing", description: "Built speed and tension through rhythmic cuts, reaction details, and changes in movement across the night." },
      { title: "Sound design", description: "Layered engines, tire noise, crowd reactions, and transitions to give the film weight beyond the music track." },
      { title: "Color grading", description: "Sculpted headlights, hard flashes, smoke, and deep blacks into a high-contrast nocturnal finish." },
    ],
  },
  {
    slug: "streamer-university-application",
    title: "Streamer University - Application",
    category: "Short film / Narrative",
    year: "2026",
    image: "/images/short-films/streamer-university.webp",
    video: "/video/short-films/streamer-university-application.mp4",
    videoPreview: "/video/short-films/preview.mp4",
    orientation: "landscape",
    gallery: [
      "/images/short-films/streamer-university-1.webp",
      "/images/short-films/streamer-university-2.webp",
      "/images/short-films/streamer-university-3.webp",
      "/images/short-films/streamer-university-4.webp",
      "/images/short-films/streamer-university-5.webp",
      "/images/short-films/streamer-university-6.webp",
    ],
    accent: "#3d7f86",
    intro: "A cinematic application film for Streamer University that turns an ordinary night at home into a fog-soaked journey to the gates.",
    challenge: "Make an application stand out by telling a story instead of listing credentials, balancing everyday family comedy with a real sense of wonder in just over two minutes.",
    approach: "Warm, lived-in interiors and natural household dialogue ground the story before it slips into a cold, moonlit fantasy of iron gates, drifting fog, and a castle-like campus lit like a feature film.",
    result: "A 2:11 short that moves from a bedroom desk to a dreamscape and back, ending on an empty gaming chair and an Enroll Now screen.",
    details: [
      { label: "Format", value: "Short film" },
      { label: "Runtime", value: "2:11" },
      { label: "Genre", value: "Narrative / fantasy" },
      { label: "Frame", value: "Widescreen" },
    ],
    services: ["Direction", "Cinematography", "Editing", "Sound design", "Color grading"],
    serviceDetails: [
      { title: "Direction", description: "Shaped a simple premise into a story with a clear turn, moving from domestic comedy into a fantasy sequence and back to a quiet final image." },
      { title: "Cinematography", description: "Contrasted warm practical light indoors with cool, fog-filled wide frames outside to separate the real world from the dream." },
      { title: "Editing", description: "Paced the family beats for timing and humor, then let the fantasy breathe with longer, atmospheric shots." },
      { title: "Sound design", description: "Built the shift from room tone and dialogue into an ambient, cinematic soundscape as the gates open." },
      { title: "Color grading", description: "Held natural skin tones and amber interiors against a teal night palette so each world reads at a glance." },
    ],
  },
];

export function getProject(slug: string) {
  return projects.find((project) => project.slug === slug);
}
