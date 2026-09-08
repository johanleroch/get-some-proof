import { cleanup, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { AccountBilling } from "./account-billing";

const mocks = vi.hoisted(() => ({
  projects: [{ id: "own-project", slug: "harbor-studio" }],
  deleting: false,
}));
vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  return {
    useAction: () => vi.fn(),
    useQuery: (reference: Parameters<typeof getFunctionName>[0]) =>
      getFunctionName(reference) === "organizations:listMine"
        ? mocks.projects
        : {
            effectivePlan: "free",
            freeProjectId: "own-project",
            usage: { freeTextUsed: 0, freeVideoUsed: 0 },
            ...(mocks.deleting ? { deletionStartedAt: 1 } : {}),
          },
  };
});
vi.mock("@/components/billing/organization-billing", () => ({
  OrganizationBilling: ({ slug }: { slug: string }) => (
    <div>Plan controls for {slug}</div>
  ),
}));
vi.mock("./account-invoices", () => ({
  AccountInvoices: () => <div>Invoice history</div>,
}));
vi.mock("./account-closure", () => ({
  AccountClosure: () => <div>Account closure</div>,
}));
beforeEach(() => {
  cleanup();
  mocks.projects = [{ id: "own-project", slug: "harbor-studio" }];
  mocks.deleting = false;
});
it("shows full plan controls in the personal account", () => {
  render(<AccountBilling />);
  expect(
    screen.getByText("Plan controls for harbor-studio"),
  ).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "View plan details" })).toBeNull();
});
it("preserves billing access without a project", () => {
  mocks.projects = [];
  render(<AccountBilling />);
  expect(
    screen.getByRole("heading", { name: "Account billing" }),
  ).toBeInTheDocument();
  expect(screen.getByText(/You have no projects/)).toBeInTheDocument();
});
it("does not expose plan actions while account deletion is running", () => {
  mocks.deleting = true;
  render(<AccountBilling />);
  expect(screen.queryByText(/Plan controls/)).toBeNull();
  expect(screen.getByText("Account closure")).toBeInTheDocument();
});

it("does not select another account's project for personal billing", () => {
  mocks.projects.unshift({ id: "foreign-project", slug: "aaa-other-account" });
  render(<AccountBilling />);
  expect(
    screen.getByText("Plan controls for harbor-studio"),
  ).toBeInTheDocument();
  expect(screen.queryByText("Plan controls for aaa-other-account")).toBeNull();
});
