import { cleanup, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { AccountBilling } from "./account-billing";

const mocks = vi.hoisted(() => ({
  account: {
    id: "account-1",
    canManageSubscription: false,
    effectivePlan: "free" as const,
    freeProjectId: "own-project" as string | null,
    usage: { freeTextUsed: 0, freeVideoUsed: 0 },
  } as null | {
    id: string;
    canManageSubscription: boolean;
    effectivePlan: "free" | "premium";
    freeProjectId: string | null;
    usage: { freeTextUsed: number; freeVideoUsed: number };
    deletionStartedAt?: number;
  },
  projects: [{ id: "own-project", slug: "bumpr" }],
}));
vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  return {
    useAction: () => vi.fn(),
    useQuery: (reference: Parameters<typeof getFunctionName>[0]) =>
      getFunctionName(reference) === "organizations:listMine"
        ? mocks.projects
        : mocks.account,
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
  mocks.account = {
    id: "account-1",
    canManageSubscription: false,
    effectivePlan: "free",
    freeProjectId: "own-project",
    usage: { freeTextUsed: 0, freeVideoUsed: 0 },
  };
  mocks.projects = [{ id: "own-project", slug: "bumpr" }];
});
it("shows full plan controls in the personal account", () => {
  render(<AccountBilling />);
  expect(screen.getByText("Plan controls for bumpr")).toBeInTheDocument();
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
  mocks.account = { ...mocks.account!, deletionStartedAt: 1 };
  render(<AccountBilling />);
  expect(screen.queryByText(/Plan controls/)).toBeNull();
  expect(screen.getByText("Account closure")).toBeInTheDocument();
});

it("does not mislabel a legacy Project owner as Free while Account migration is missing", () => {
  mocks.account = null;
  render(<AccountBilling />);
  expect(screen.queryByRole("heading", { name: "Free plan" })).toBeNull();
  expect(
    screen.getByRole("heading", { name: "Billing setup needs attention" }),
  ).toBeInTheDocument();
  expect(screen.queryByText("Plan controls for bumpr")).toBeNull();
});

it("does not diagnose a migration failure for an existing Account with no owned Project", () => {
  mocks.account = { ...mocks.account!, freeProjectId: null };
  render(<AccountBilling />);
  expect(
    screen.queryByRole("heading", { name: "Billing setup needs attention" }),
  ).toBeNull();
  expect(
    screen.getByRole("heading", { name: "Free plan" }),
  ).toBeInTheDocument();
});

it("does not select another account's project for personal billing", () => {
  mocks.projects.unshift({ id: "foreign-project", slug: "aaa-other-account" });
  render(<AccountBilling />);
  expect(screen.getByText("Plan controls for bumpr")).toBeInTheDocument();
  expect(screen.queryByText("Plan controls for aaa-other-account")).toBeNull();
});
