import { cleanup, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Id } from "@convex/_generated/dataModel";
import { ProjectManager } from "./project-manager";

const mocks = vi.hoisted(() => ({
  plan: "free" as "free" | "premium",
  role: "owner" as "owner" | "admin" | "editor" | "viewer",
  mutation: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");

  return {
    useMutation: () => mocks.mutation,
    useQuery: (reference: Parameters<typeof getFunctionName>[0]) => {
      const name = getFunctionName(reference);
      if (name === "projects:list") {
        return [
          {
            description: "Existing Project stays readable.",
            id: "project_alpha" as Id<"projects">,
            name: "Alpha",
            status: "active" as const,
          },
        ];
      }
      if (name === "billing:getProjectEntitlement") {
        return { effectivePlan: mocks.plan };
      }
      const canWrite = mocks.role !== "viewer";
      return {
        can: {
          createProjects: canWrite,
          deleteProjects: mocks.role === "owner" || mocks.role === "admin",
          manageBilling: mocks.role === "owner",
          readBilling: mocks.role === "owner" || mocks.role === "admin",
        },
        role: mocks.role,
      };
    },
  };
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/org/acme/projects",
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => ({ get: () => null }),
}));

describe("ProjectManager Pro controls", () => {
  beforeEach(() => {
    cleanup();
    mocks.plan = "free";
    mocks.role = "owner";
    mocks.mutation.mockReset();
    mocks.replace.mockReset();
  });

  it.each([
    ["owner", "free", false, true],
    ["admin", "free", false, true],
    ["editor", "free", false, true],
    ["viewer", "free", false, false],
    ["owner", "premium", true, false],
    ["admin", "premium", true, false],
    ["editor", "premium", true, false],
    ["viewer", "premium", false, false],
  ] as const)(
    "renders %s on %s with write controls=%s",
    (role, plan, canWrite, showsProExplanation) => {
      mocks.role = role;
      mocks.plan = plan;

      render(
        <ProjectManager
          organizationId={"organization_acme" as Id<"organizations">}
          organizationSlug="acme"
        />,
      );

      expect(screen.getByText("Alpha")).toBeVisible();
      expect(
        screen.queryByRole("button", { name: "New Project" }) !== null,
      ).toBe(canWrite);
      expect(
        screen.queryByRole("button", { name: "Edit Alpha" }) !== null,
      ).toBe(canWrite);
      expect(
        screen.queryByText("Pro required for Project changes") !== null,
      ).toBe(showsProExplanation);
    },
  );

  it("sends a Free Owner to the Organization Billing page", () => {
    render(
      <ProjectManager
        organizationId={"organization_acme" as Id<"organizations">}
        organizationSlug="acme"
      />,
    );

    expect(
      screen.getByRole("link", { name: "View Pro plans" }),
    ).toHaveAttribute("href", "/org/acme/billing");
    expect(screen.queryByRole("button", { name: "Delete Alpha" })).toBeNull();
  });
});
