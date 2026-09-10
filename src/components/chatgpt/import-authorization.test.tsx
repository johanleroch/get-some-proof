import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ImportAuthorization } from "./import-authorization";

const state = vi.hoisted(() => ({
  paid: true,
  activated: true,
  activate: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useQuery: () => ({ paid: state.paid, activated: state.activated }),
  useMutation: () => state.activate,
}));
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
  state.paid = true;
  state.activated = true;
  state.activate.mockReset();
  vi.unstubAllGlobals();
});
const query =
  "client_id=trusted-client&scope=testimonials%3Aimport%3Aassistant+offline_access&sig=server-signature";

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
    "This request may have expired. Return to your assistant and try connecting again.",
  );
  expect(fetcher.mock.calls[1]?.[1].body).toBe(
    JSON.stringify({ accept: false, oauth_query: query }),
  );
  expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
});

it("keeps Free accounts from allowing a connection while preserving refusal", async () => {
  state.paid = false;
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ client_name: "Codex" })),
      ),
  );
  render(<ImportAuthorization oauthQuery={query} />);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled(),
  );
  expect(screen.getByRole("link", { name: "Upgrade to Pro" })).toHaveAttribute(
    "href",
    "/account/billing",
  );
  expect(
    screen.getByRole("button", { name: "Allow connection" }),
  ).toBeDisabled();
});

it("requires reuse rights and saves attestation before submitting consent", async () => {
  state.activated = false;
  state.activate.mockResolvedValue(null);
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ client_name: "Claude" })),
    )
    .mockResolvedValueOnce(new Response("{}", { status: 400 }));
  vi.stubGlobal("fetch", fetcher);
  render(<ImportAuthorization oauthQuery={query} />);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled(),
  );
  expect(
    screen.getByRole("button", { name: "Allow connection" }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Allow connection" }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  expect(state.activate).toHaveBeenCalledWith({ acceptReuseRights: true });
  expect(state.activate.mock.invocationCallOrder[0]).toBeLessThan(
    fetcher.mock.invocationCallOrder[1]!,
  );
});

it("keeps the existing Free wall-import consent available", async () => {
  state.paid = false;
  state.activated = false;
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ client_name: "Existing ChatGPT wall importer" }),
        ),
      ),
  );
  render(
    <ImportAuthorization
      oauthQuery={query.replace(
        "testimonials%3Aimport%3Aassistant",
        "testimonials%3Aimport",
      )}
    />,
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Allow connection" }),
    ).toBeEnabled(),
  );
  expect(screen.queryByRole("checkbox")).toBeNull();
  expect(screen.queryByRole("link", { name: "Upgrade to Pro" })).toBeNull();
});
