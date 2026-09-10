import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicWallResponse } from "@/lib/public-wall-response";
import { wallFromResponse } from "@/lib/public-wall-response";

const signal = vi.hoisted(() => ({ revision: 0 as number | null | undefined }));
vi.mock("convex/react", () => ({ useQuery: () => signal.revision }));
import { PublicWallLive } from "./public-wall-live";

const page: PublicWallResponse = {
  brand: {
    name: "Mira Studio",
    publicSlug: "mira-studio",
    accentColor: "#123abc",
    accentInk: "#ffffff",
    attributionRequired: true,
    theme: "light",
    transparentEmbed: false,
  },
  pagination: { cursor: "signed-next-page" },
  privacyRevision: 0,
  schemaVersion: 1,
  testimonials: [
    {
      id: "first",
      name: "Mira",
      text: "Our first customer proof.",
      type: "text",
      publishedAt: 1,
      avatarUrl: null,
    },
  ],
};
const element = () => (
  <PublicWallLive
    initialWall={wallFromResponse(page)}
    initialCursor={page.pagination.cursor}
    initialPrivacyRevision={page.privacyRevision}
  />
);
const respond = (value: PublicWallResponse) =>
  Promise.resolve(Response.json(value));

describe("Public Wall mediated refresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    signal.revision = 0;
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("keeps testimonials visible when the initial privacy signal cancels a pending refresh", async () => {
    signal.revision = undefined;
    const fetch = vi.fn(
      (_path: string, options: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          options.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const view = render(element());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    signal.revision = page.privacyRevision;
    await act(async () => {
      view.rerender(element());
    });
    expect(screen.queryByText("No public testimonials yet.")).toBeNull();
    expect(screen.getByText("Our first customer proof.")).toBeVisible();
  });

  it("still clears testimonials when the active refresh times out", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_path: string, options: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            options.signal?.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            );
          }),
      ),
    );
    render(element());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(screen.queryByText("Our first customer proof.")).toBeNull();
  });

  it("refreshes every loaded page without losing depth or retaining stale second-page content", async () => {
    const second = {
      ...page,
      pagination: { cursor: null },
      testimonials: [
        {
          ...page.testimonials[0],
          id: "second",
          text: "Second page before refresh.",
        },
      ],
    } as PublicWallResponse;
    let refreshed = false;
    const fetch = vi.fn((path: string) =>
      respond(
        path.includes("?cursor=")
          ? ({
              ...second,
              testimonials: [
                {
                  ...second.testimonials[0],
                  text: refreshed
                    ? "Second page refreshed."
                    : "Second page before refresh.",
                },
              ],
            } as PublicWallResponse)
          : page,
      ),
    );
    vi.stubGlobal("fetch", fetch);
    render(element());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Load more testimonials" }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText("Second page before refresh.")).toBeVisible();
    refreshed = true;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(screen.getByText("Our first customer proof.")).toBeVisible();
    expect(screen.getByText("Second page refreshed.")).toBeVisible();
    expect(screen.queryByText("Second page before refresh.")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Load more testimonials" }),
    ).toBeNull();
  });

  it("loads signed pages and immediately hides all pages on privacy invalidation", async () => {
    const fetch = vi
      .fn()
      .mockImplementationOnce(() => respond(page))
      .mockImplementationOnce(() =>
        respond({
          ...page,
          pagination: { cursor: null },
          testimonials: [
            {
              ...page.testimonials[0],
              type: "text",
              id: "second",
              text: "Our second customer proof.",
            },
          ],
        }),
      )
      .mockImplementation(() => new Promise(() => {}));
    vi.stubGlobal("fetch", fetch);
    const view = render(element());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Load more testimonials" }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText("Our first customer proof.")).toBeVisible();
    expect(screen.getByText("Our second customer proof.")).toBeVisible();
    expect(fetch.mock.calls[1][0]).toBe(
      "/api/public-wall/mira-studio?cursor=signed-next-page",
    );
    signal.revision = 1;
    view.rerender(element());
    expect(screen.queryByText("Our first customer proof.")).toBeNull();
    expect(screen.queryByText("Our second customer proof.")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Load more testimonials" }),
    ).toBeNull();
  });

  it("refreshes content and Brand presentation within the freshness deadline", async () => {
    const fetch = vi
      .fn()
      .mockImplementationOnce(() => respond(page))
      .mockImplementation(() =>
        respond({
          ...page,
          brand: {
            ...page.brand,
            name: "Mira Workshop",
            attributionRequired: false,
            theme: "dark",
          },
          testimonials: [
            {
              ...page.testimonials[0],
              type: "text",
              text: "Updated public proof.",
            },
          ],
        }),
      );
    vi.stubGlobal("fetch", fetch);
    render(element());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(screen.getByText("Updated public proof.")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Mira Workshop" }),
    ).toBeVisible();
    expect(screen.getByRole("main")).toHaveAttribute("data-wall-theme", "dark");
    expect(
      screen.queryByRole("complementary", { name: "Get Some Proof" }),
    ).toBeNull();
    expect(fetch.mock.calls[1][1]).toMatchObject({ cache: "no-store" });
  });

  it("clears stale content if refresh fails or the Brand disappears", async () => {
    const fetch = vi
      .fn()
      .mockImplementationOnce(() => respond(page))
      .mockResolvedValue(new Response(null, { status: 503 }));
    vi.stubGlobal("fetch", fetch);
    const view = render(element());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(screen.queryByText("Our first customer proof.")).toBeNull();
    signal.revision = null;
    view.rerender(element());
    expect(screen.queryByText("Our first customer proof.")).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
  });
});
