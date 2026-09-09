import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ImportAuthorization } from "./import-authorization";

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({
      isPending: false,
      data: { user: { email: "maya@juniper.example", emailVerified: true } },
    }),
  },
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const query =
  "client_id=trusted-client&scope=testimonials%3Aimport+offline_access&sig=server-signature";

it("refuses unsigned requests and unrecognized permissions before fetching client details", () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const { rerender } = render(
    <ImportAuthorization oauthQuery="client_id=trusted-client&scope=testimonials%3Aimport" />,
  );
  expect(
    screen.getByRole("heading", { name: "Connection unavailable" }),
  ).toBeVisible();
  const changed = new URLSearchParams(query);
  changed.set("scope", "testimonials:import account:delete");
  rerender(<ImportAuthorization oauthQuery={changed.toString()} />);
  expect(screen.queryByRole("button", { name: "Allow connection" })).toBeNull();
  expect(fetcher).not.toHaveBeenCalled();
});

it("keeps forced sign-in and the complete authorization request in the login callback", () => {
  render(<ImportAuthorization oauthQuery={query} signInRequired />);
  expect(
    screen.getByRole("link", { name: "Sign in to continue" }),
  ).toHaveAttribute(
    "href",
    `/sign-in?callbackURL=${encodeURIComponent(`/import/authorize?${query}`)}`,
  );
  expect(screen.queryByRole("button", { name: "Allow connection" })).toBeNull();
});

it("submits explicit refusal and recovers visibly when the signed request expired", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ client_name: "Proof importer" }), {
        status: 200,
      }),
    )
    .mockResolvedValueOnce(new Response("{}", { status: 400 }));
  vi.stubGlobal("fetch", fetcher);
  render(<ImportAuthorization oauthQuery={query} />);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await screen.findByText(
    "This request may have expired. Return to ChatGPT and try connecting again.",
  );
  expect(fetcher.mock.calls[1]?.[1].body).toBe(
    JSON.stringify({ accept: false, oauth_query: query }),
  );
  expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
});
