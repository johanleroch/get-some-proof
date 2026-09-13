import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import type { Id } from "@convex/_generated/dataModel";
import { GoogleBusiness } from "./google-business";

const mocks = vi.hoisted(() => ({
  status: {
    connected: true,
    configured: true,
    disconnecting: false,
    generation: "one",
    notificationsConfigured: true,
    notifications: {
      account: "accounts/12",
      location: "locations/34",
      revision: 0,
      lastEventAt: null as number | null,
    },
  },
  read: vi.fn(),
  other: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useQuery: () => mocks.status,
  useAction: (ref: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(ref) === "googleBusinessActions:read"
      ? mocks.read
      : mocks.other,
  useMutation: () => mocks.other,
}));
afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.clearAllMocks();
});

it("loads the subscribed location on reopening and refreshes after a notification revision", async () => {
  mocks.read.mockResolvedValueOnce({
    items: [
      {
        name: "review1",
        title: "Camille Roche",
        comment: "Original review.",
        rating: "FIVE",
      },
    ],
    nextPageToken: null,
  });
  const ui = render(
    <GoogleBusiness organizationId={"project" as Id<"organizations">} />,
  );
  expect(await screen.findByText("Original review.")).toBeVisible();
  expect(mocks.read).toHaveBeenCalledWith({
    organizationId: "project",
    account: "accounts/12",
    location: "locations/34",
    pageToken: undefined,
  });
  mocks.read.mockResolvedValueOnce({
    items: [
      {
        name: "review1",
        title: "Camille Roche",
        comment: "Updated on Google.",
        rating: "FOUR",
      },
    ],
    nextPageToken: null,
  });
  vi.useFakeTimers();
  mocks.status = {
    ...mocks.status,
    notifications: {
      ...mocks.status.notifications,
      revision: 1,
      lastEventAt: Date.now(),
    },
  };
  ui.rerender(
    <GoogleBusiness organizationId={"project" as Id<"organizations">} />,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3000);
  });
  expect(screen.getByText("Updated on Google.")).toBeVisible();
  expect(mocks.read).toHaveBeenCalledTimes(2);
  expect(screen.queryByText("Original review.")).not.toBeInTheDocument();
});
