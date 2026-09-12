import type { WidgetConfig } from "@convex/domain/widgets";
export const widgetTemplates: {
  layout: WidgetConfig["layout"];
  title: string;
  description: string;
}[] = [
  {
    layout: "wall",
    title: "Wall of fame",
    description: "A complete wall with your project name.",
  },
  {
    layout: "individual",
    title: "Individual testimonial",
    description: "One voice, right where it matters.",
  },
  {
    layout: "carousel",
    title: "Horizontal carousel",
    description: "Browse your proof, one swipe at a time.",
  },
  {
    layout: "masonry",
    title: "Masonry grid",
    description: "Text and video, in their natural shape.",
  },
  {
    layout: "highlights",
    title: "Testimonial highlights",
    description: "Let your customers’ strongest words stand out.",
  },
  {
    layout: "avatars",
    title: "Avatar stack",
    description: "A familiar row of faces beside your call to action.",
  },
];
export const initialWidgetConfig: WidgetConfig = {
  layout: "wall",
  font: "inherit",
  accentColor: "#ffbb16",
  backgroundColor: "#ffffff",
  textColor: "#2e2a25",
};
