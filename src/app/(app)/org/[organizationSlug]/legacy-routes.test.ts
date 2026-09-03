import { beforeEach, describe, expect, it, vi } from "vitest";

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  redirect: redirectMock,
}));

import OrganizationAuditPage from "@/app/(app)/org/[organizationSlug]/audit/page";
import OrganizationMembersPage from "@/app/(app)/org/[organizationSlug]/members/page";
import OrganizationProjectsPage from "@/app/(app)/org/[organizationSlug]/projects/page";

describe("hidden starter routes", () => {
  beforeEach(() => {
    redirectMock.mockClear();
  });

  it.each([
    ["projects", OrganizationProjectsPage],
    ["members", OrganizationMembersPage],
    ["audit", OrganizationAuditPage],
  ])("redirects the %s surface to the Brand dashboard", async (_, page) => {
    await expect(
      page({ params: Promise.resolve({ organizationSlug: "acme-1234" }) }),
    ).rejects.toThrow("NEXT_REDIRECT:/org/acme-1234/dashboard");

    expect(redirectMock).toHaveBeenCalledWith("/org/acme-1234/dashboard");
  });
});
