import { beforeEach, expect, it, vi } from "vitest";
import OrganizationBillingPage from "./page";

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect }));
beforeEach(() => redirect.mockReset());
it.each([undefined, "success", "cancelled"])(
  "moves legacy billing into Account and preserves checkout=%s",
  async (checkout) => {
    await OrganizationBillingPage({
      searchParams: Promise.resolve({ checkout }),
    });
    expect(redirect).toHaveBeenCalledWith(
      `/account/billing${checkout ? `?checkout=${checkout}` : ""}`,
    );
  },
);
