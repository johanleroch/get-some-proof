import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MemberDirectory } from "./member-directory";

const mocks = vi.hoisted(() => ({
  queryIndex: 0,
  replace: vi.fn(),
  mutation: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock("convex/react", () => ({
  useMutation: () => mocks.mutation,
  useQuery: () => {
    const values = [
      [
        {
          id: "membership-1",
          userId: "user-1",
          displayName: "Johan Le Roch",
          email: "johan@example.com",
          role: "owner",
        },
      ],
      { can: { manageMembers: true, manageOwnership: true } },
      { id: "user-1" },
      [],
    ];
    return values[mocks.queryIndex++ % values.length];
  },
}));

describe("MemberDirectory", () => {
  beforeEach(() => {
    mocks.queryIndex = 0;
    mocks.replace.mockReset();
    mocks.mutation.mockReset();
  });

  it("dismisses an open confirmation dialog with Escape", () => {
    render(<MemberDirectory organizationId={"organization-1" as never} />);

    fireEvent.click(screen.getByRole("button", { name: "Leave Organization" }));
    expect(
      screen.getByRole("alertdialog", { name: "Leave Organization?" }),
    ).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(
      screen.queryByRole("alertdialog", { name: "Leave Organization?" }),
    ).toBeNull();
  });
});
