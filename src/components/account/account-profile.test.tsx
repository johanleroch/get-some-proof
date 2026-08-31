import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AccountProfile } from "./account-profile";

const mocks = vi.hoisted(() => ({
  refetch: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: {
        user: {
          email: "johan@example.com",
          image: null,
          name: "Johan Le Roch",
        },
      },
      refetch: mocks.refetch,
    }),
    updateUser: mocks.updateUser,
  },
}));

describe("AccountProfile", () => {
  beforeEach(() => {
    mocks.refetch.mockReset();
    mocks.updateUser.mockReset();
    mocks.updateUser.mockResolvedValue({ data: { status: true }, error: null });
  });

  it("updates the Better Auth profile and refreshes the session", async () => {
    render(<AccountProfile />);

    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "Johan LR" },
    });
    fireEvent.change(screen.getByLabelText("Avatar URL"), {
      target: { value: "https://example.com/johan.jpg" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(mocks.updateUser).toHaveBeenCalledWith({
        image: "https://example.com/johan.jpg",
        name: "Johan LR",
      });
    });
    expect(mocks.refetch).toHaveBeenCalledOnce();
    expect(await screen.findByText("Profile updated.")).toBeInTheDocument();
  });

  it("keeps the verified email read-only", () => {
    render(<AccountProfile />);

    expect(screen.getByLabelText("Email address")).toBeDisabled();
    expect(screen.getByLabelText("Email address")).toHaveValue(
      "johan@example.com",
    );
  });
});
