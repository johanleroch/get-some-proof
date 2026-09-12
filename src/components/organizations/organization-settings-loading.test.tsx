import { cleanup, render, screen } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { afterEach, expect, it, vi } from "vitest";
import {
  OrganizationSettings,
  OrganizationSettingsSkeleton,
} from "./organization-settings";

const state = vi.hoisted(() => ({
  result: undefined as undefined | null,
  deletion: null as Record<string, unknown> | null,
}));
vi.mock("convex/react", () => ({
  useQuery: (reference: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(reference) === "workspaceDeletion:getByOrganizationSlug" &&
    state.deletion
      ? state.deletion
      : state.result,
  useMutation: () => vi.fn(),
  useAction: () => vi.fn(),
}));
afterEach(() => {
  cleanup();
  state.result = undefined;
  state.deletion = null;
});

it("does not flash settings while a deleted project is being resolved", () => {
  const { container, rerender } = render(
    <OrganizationSettings slug="deleted-project" embedOrigin="" />,
  );
  expect(container.querySelector("input")).toBeNull();
  expect(screen.queryByText("Brand settings")).not.toBeInTheDocument();
  state.result = null;
  rerender(<OrganizationSettings slug="deleted-project" embedOrigin="" />);
  expect(
    screen.getByRole("heading", { name: "Brand unavailable" }),
  ).toBeVisible();
  expect(container.querySelector("input")).toBeNull();
});

it("uses the same neutral state for the route fallback", () => {
  const { container } = render(<OrganizationSettingsSkeleton />);
  expect(container.querySelector("input")).toBeNull();
  expect(screen.getByRole("status", { name: "Loading project" })).toBeVisible();
});

it("keeps tracking a deletion recovered after reload when the organization disappears", () => {
  state.result = null;
  state.deletion = {
    brandName: "Deleted project",
    deletionId: "deletion-id",
    organizationId: "organization-id",
    phase: "deleteMedia",
    status: "requested",
  };
  const { rerender } = render(
    <OrganizationSettings slug="deleted-project" embedOrigin="" />,
  );
  expect(
    screen.getByRole("heading", { name: "Deleting Deleted project" }),
  ).toBeVisible();
  state.deletion = null;
  rerender(<OrganizationSettings slug="deleted-project" embedOrigin="" />);
  expect(
    screen.queryByRole("heading", { name: "Brand unavailable" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Deleting Deleted project" }),
  ).toBeVisible();
});
