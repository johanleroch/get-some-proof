import { notFound } from "next/navigation";
import { WidgetGallery } from "./gallery";

export default function WidgetGalleryPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <WidgetGallery />;
}
