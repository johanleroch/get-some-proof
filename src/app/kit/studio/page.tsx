import { notFound } from "next/navigation";
import { StudioFixture } from "@/components/visual-evidence/studio-fixture";

export default async function StudioKitPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { view } = await searchParams;
  return (
    <StudioFixture
      editor={view !== "widgets" && view !== "templates"}
      preview={view === "preview"}
      choosing={view === "templates"}
    />
  );
}
