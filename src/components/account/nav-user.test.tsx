import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";
import { NavUser } from "./nav-user";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  replace: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useQuery: () => ({
    email: "johan@example.com",
    image: null,
    name: "Johan Le Roch",
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mocks.refresh,
    replace: mocks.replace,
  }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signOut: mocks.signOut,
  },
}));

describe("NavUser", () => {
  beforeEach(() => {
    cleanup();
    mocks.refresh.mockReset();
    mocks.replace.mockReset();
    mocks.signOut.mockReset();
    mocks.signOut.mockResolvedValue({ data: null, error: null });
  });

  function renderMenu() {
    render(
      <SidebarProvider>
        <NavUser />
      </SidebarProvider>,
    );
    fireEvent.pointerDown(
      screen.getByRole("button", { name: "Open user menu" }),
      {
        button: 0,
        ctrlKey: false,
      },
    );
  }

  it("links to profile and security settings", () => {
    renderMenu();

    expect(screen.getByRole("menuitem", { name: "Profile" })).toHaveAttribute(
      "href",
      "/account/profile",
    );
    expect(screen.getByRole("menuitem", { name: "Security" })).toHaveAttribute(
      "href",
      "/account/security",
    );
  });

  it("signs out from the footer menu", async () => {
    renderMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Log out" }));

    await waitFor(() => {
      expect(mocks.signOut).toHaveBeenCalledOnce();
    });
    expect(mocks.replace).toHaveBeenCalledWith("/sign-in");
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });
});
