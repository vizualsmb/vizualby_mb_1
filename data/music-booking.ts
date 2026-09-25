import type { PackageDefinition } from "./booking";

// Owner-supplied pricing and scope. Availability and rescheduling terms still pending.
export const musicBookingTerms = {
  deposit: "A non-refundable deposit of 50% of the package price is required to secure your shoot date.",
  balance: "The remaining balance is due according to the booking agreement.",
  tagline: "Raw. Real. Relentless.",
};

export const musicPackages: PackageDefinition[] = [
  {
    id: "music-run-and-gun", category: "music", name: "Run & Gun",
    tagline: "Clean, professional performance visuals without a large production.",
    fullDescription: "Perfect for artists who need a clean, professional performance video without a large production.",
    bestFor: "Performance videos, freestyle visuals, and simple music videos.",
    price: 50000, minutes: 120, locations: 1, revisions: 1,
    delivery: "Delivery agreed before booking", addonIds: ["music-concept"],
    includes: ["Up to 2 hours of filming", "1 location", "Performance-focused direction", "Professional camera setup", "Cinematic editing", "Basic color grading", "Simple visual effects/transitions", "1 revision"],
  },
  {
    id: "music-creative", category: "music", name: "Creative",
    tagline: "Stronger visuals, lighting, creative direction, and multiple setups.",
    bestFor: "Cinematic music videos with a more polished and creative look.",
    price: 80000, minutes: 240, locations: 2, revisions: 2,
    locationLabel: "Up to 2 locations", featured: true,
    delivery: "Delivery agreed before booking", addonIds: ["music-concept"],
    includes: ["Up to 4 hours of filming", "Up to 2 locations", "Creative direction", "Light concept/storyboard planning", "Professional lighting setup", "Multiple performance setups", "Cinematic editing", "Professional color grading", "Creative transitions/effects", "Up to 2 revisions"],
  },
  {
    id: "music-full-concept", category: "music", name: "Full Concept",
    tagline: "A complete production built around your song, concept, and visual identity.",
    bestFor: "Story-driven videos, major releases, and artists looking for a premium production.",
    price: 150000, minutes: 360, locations: 0, revisions: 3,
    locationLabel: "Multiple locations",
    delivery: "Scope + delivery agreed by proposal", addonIds: [],
    includes: ["Up to 6 hours of filming", "Multiple locations", "Full creative concept development", "Treatment / storyboard", "Pre-production planning", "Professional cinematic lighting", "Advanced shot design and direction", "Drone footage when appropriate", "BTS content", "Advanced cinematic editing", "Professional color grade", "Visual effects when needed", "Up to 3 revisions"],
  },
];

// Scope-sensitive extras are displayed but cannot silently change the booked slot.
export const musicRequestedAddons = [
  { name: "Additional filming time", price: "$100/hr", detail: "Requires an extended shoot slot and studio confirmation." },
  { name: "Additional location", price: "Starting at $100", detail: "Confirm travel time and the revised shoot scope first." },
  { name: "Rush 48-hour delivery", price: "+$150", detail: "Subject to studio confirmation of delivery capacity." },
  { name: "Drone footage", price: "+$100", detail: "Subject to location, conditions, and studio confirmation; included when appropriate in Full Concept." },
  { name: "Additional revisions", price: "Quoted separately", detail: "Confirm the additional edit scope with the studio." },
  { name: "Travel outside the local service area", price: "Additional fee may apply", detail: "Confirm any travel fee before paying your deposit." },
];
