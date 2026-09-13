"use client";

import type { Id } from "@convex/_generated/dataModel";
import { GoogleBusiness } from "../testimonials/google-business";
import type { ConnectorPanel } from "./types";

/** Register installed connectors here; the import screen has no provider branches. */
const connectors = [
  {
    id: "google",
    label: "Google Business Profile",
    Connection: GoogleBusiness,
  },
] as const;

export function reviewConnectorPanels(
  organizationId: Id<"organizations">,
): ConnectorPanel[] {
  return connectors.map(({ id, label, Connection }) => ({
    id,
    label,
    content: <Connection organizationId={organizationId} />,
  }));
}
