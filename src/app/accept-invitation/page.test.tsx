import { beforeEach, describe, expect, it, vi } from "vitest";

const { notFoundMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  notFound: notFoundMock,
}));

import AcceptInvitationPage from "@/app/accept-invitation/page";

describe("accept invitation page", () => {
  beforeEach(() => {
    notFoundMock.mockClear();
  });

  it("keeps the inherited invitation UI unavailable in the MVP", () => {
    expect(() => AcceptInvitationPage()).toThrow("NEXT_NOT_FOUND");

    expect(notFoundMock).toHaveBeenCalledOnce();
  });
});
