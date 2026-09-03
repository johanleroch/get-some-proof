import { notFound } from "next/navigation";

import { ProjectEntitlementVisualFixture } from "@/components/projects/project-entitlement-visual-fixture";

export default function ProjectEntitlementVisualEvidencePage() {
  if (process.env.VISUAL_EVIDENCE_MODE !== "true") notFound();

  return <ProjectEntitlementVisualFixture />;
}
