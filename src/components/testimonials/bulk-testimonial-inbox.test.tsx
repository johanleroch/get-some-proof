import { collectInboxSelection } from "./inbox-bulk";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@convex/_generated/dataModel";
import { BulkTestimonialInbox } from "./bulk-testimonial-inbox";
import type { InboxTestimonial } from "./testimonial-inbox";

const text = (name: string): InboxTestimonial => ({
  testimonialId: name as Id<"testimonials">,
  submitterName: name,
  moderationStatus: "pending",
  createdAt: 1,
  submissionType: "text",
  card: {
    id: name,
    avatarUrl: null,
    name,
    type: "text",
    text: "The studio made our launch much easier.",
    publishedAt: 1,
  },
});
const alice = text("Alice Martin");
const remy = text("Remy Jupille");
const nina = text("Nina Laurent");
const video: InboxTestimonial = {
  ...text("Lou Bernard"),
  submissionType: "video",
  card: null,
  videoStatus: "processing",
  captionsStatus: "requested",
};
const page = (
  items: InboxTestimonial[],
  isDone = true,
  continueCursor = "",
) => ({ page: items, isDone, continueCursor });
const selectDisplayed = () =>
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Select displayed testimonials" }),
  );
function setup(
  overrides: Partial<React.ComponentProps<typeof BulkTestimonialInbox>> = {},
) {
  const perform = vi.fn().mockResolvedValue(undefined);
  const props = {
    category: "pending" as const,
    testimonials: [alice, remy],
    pendingId: null,
    onAction: vi.fn(),
    totalCount: 2,
    hasMore: false,
    loadPage: vi.fn().mockResolvedValue(page([alice, remy])),
    perform,
    ...overrides,
  };
  return { ...render(<BulkTestimonialInbox {...props} />), props, perform };
}
afterEach(cleanup);

describe("Bulk Inbox selection and operations", () => {
  it("selects displayed rows, exposes mixed state, and clears selection", () => {
    setup();
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Select Alice Martin's testimonial",
      }),
    );
    expect(
      screen.getByRole("checkbox", { name: "Select displayed testimonials" }),
    ).toHaveAttribute("aria-checked", "mixed");
    expect(screen.getByTestId("inbox-testimonial-Alice Martin")).toHaveClass(
      "bg-brand-soft",
    );
    selectDisplayed();
    expect(screen.getByText("2 selected")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(
      screen.getByRole("checkbox", { name: "Select displayed testimonials" }),
    ).not.toBeChecked();
  });

  it("loads every page, allows exclusions, and acts on unloaded rows", async () => {
    const loadPage = vi
      .fn()
      .mockResolvedValueOnce(page([alice, remy], false, "next"))
      .mockResolvedValueOnce(page([nina]));
    const { perform } = setup({ hasMore: true, totalCount: 3, loadPage });
    selectDisplayed();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Select all 3 testimonials in this tab",
      }),
    );
    await screen.findByText("3 selected");
    expect(loadPage.mock.calls).toEqual([[null], ["next"]]);
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Select Remy Jupille's testimonial",
      }),
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Archive" })[0]!);
    await screen.findByText("2 archived.");
    expect(perform.mock.calls.map(([item]) => item.testimonialId)).toEqual([
      alice.testimonialId,
      nina.testimonialId,
    ]);
  });

  it("retains failures and unpublished processing videos while successful items leave selection", async () => {
    const perform = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Publication quota reached."));
    setup({ testimonials: [alice, remy, video], totalCount: 3, perform });
    selectDisplayed();
    expect(
      screen.getByText(
        "2 ready to publish · 1 video not ready will stay selected.",
      ),
    ).toBeVisible();
    fireEvent.click(screen.getAllByRole("button", { name: "Publish" })[0]!);
    await screen.findByText("1 published · 1 failed · 1 videos not ready.");
    expect(perform).toHaveBeenCalledTimes(2);
    expect(
      screen.getByRole("checkbox", {
        name: "Select Alice Martin's testimonial",
      }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", {
        name: "Select Remy Jupille's testimonial",
      }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", {
        name: "Select Lou Bernard's testimonial",
      }),
    ).toBeChecked();
    expect(
      screen.getByText("Remy Jupille: Publication quota reached."),
    ).toBeVisible();
  });

  it("asks once for import permission, then applies it to the entire publication batch", async () => {
    const imported = { ...alice, requiresImportAttestation: true };
    const { perform } = setup({ testimonials: [imported, remy] });
    selectDisplayed();
    fireEvent.click(screen.getAllByRole("button", { name: "Publish" })[0]!);
    const dialog = screen.getByRole("dialog");
    const publish = within(dialog).getByRole("button", {
      name: "Publish 2 testimonials",
    });
    expect(publish).toBeDisabled();
    expect(perform).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("checkbox"));
    fireEvent.click(publish);
    await screen.findByText("2 published.");
    expect(perform.mock.calls.map((call) => call[2])).toEqual([true, true]);
  });

  it("requires a count-specific confirmation before deleting", async () => {
    const { perform } = setup();
    selectDisplayed();
    fireEvent.pointerDown(
      screen.getByRole("button", { name: "More bulk actions" }),
      { button: 0, ctrlKey: false },
    );
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Delete permanently" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Permanently delete 2 testimonials?",
    });
    expect(perform).not.toHaveBeenCalled();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Delete 2 testimonials" }),
    );
    await screen.findByText("2 deleted.");
    expect(perform.mock.calls.map((call) => call[1])).toEqual([
      "delete",
      "delete",
    ]);
  });

  it("refreshes an off-page video's readiness without reselecting exclusions", async () => {
    const readyVideo: InboxTestimonial = {
      ...video,
      videoStatus: "ready",
      card: {
        id: video.testimonialId,
        name: video.submitterName,
        type: "video",
        avatarUrl: null,
        publishedAt: 1,
        playbackId: "ready-playback",
        captionsAvailable: false,
      },
    };
    const loadPage = vi
      .fn()
      .mockResolvedValueOnce(page([alice, remy, video]))
      .mockResolvedValueOnce(page([alice, remy, readyVideo, nina]));
    const { perform } = setup({ hasMore: true, totalCount: 3, loadPage });
    selectDisplayed();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Select all 3 testimonials in this tab",
      }),
    );
    await screen.findByText("3 selected");
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Select Remy Jupille's testimonial",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Refresh selected testimonials" }),
    );
    await screen.findByText("Selection refreshed.");
    fireEvent.click(screen.getAllByRole("button", { name: "Publish" })[0]!);
    await screen.findByText("2 published.");
    expect(perform.mock.calls.map(([item]) => item.testimonialId)).toEqual([
      alice.testimonialId,
      video.testimonialId,
    ]);
  });

  it("keeps the previous selection when a later page fails", async () => {
    const loadPage = vi
      .fn()
      .mockResolvedValueOnce(page([alice, remy], false, "next"))
      .mockRejectedValueOnce(new Error("Connection interrupted."));
    setup({ hasMore: true, totalCount: 3, loadPage });
    selectDisplayed();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Select all 3 testimonials in this tab",
      }),
    );
    await screen.findByText("Connection interrupted.");
    expect(screen.getByText("2 selected")).toBeVisible();
  });

  it("stops unsent writes when leaving the scope and prevents double submission", async () => {
    let finish!: () => void;
    const perform = vi.fn().mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const { unmount } = setup({ perform });
    selectDisplayed();
    const archive = screen.getAllByRole("button", {
      name: "Archive",
    })[0]!;
    fireEvent.click(archive);
    fireEvent.click(archive);
    expect(perform).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("checkbox", { name: "Select displayed testimonials" }),
    ).toBeDisabled();
    unmount();
    await act(async () => {
      finish();
    });
    expect(perform).toHaveBeenCalledTimes(1);
  });

  it("cancels select-all without restoring an old async selection", async () => {
    let finish!: (value: ReturnType<typeof page>) => void;
    setup({
      hasMore: true,
      totalCount: 3,
      loadPage: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    });
    selectDisplayed();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Select all 3 testimonials in this tab",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    await act(async () => {
      finish(page([alice, remy, nina]));
    });
    expect(screen.queryByText("3 selected")).toBeNull();
  });

  it("offers restoration in Spam and unpublish in Published", () => {
    const { unmount } = setup({
      category: "spam",
      testimonials: [{ ...alice, moderationStatus: "spam" }],
    });
    selectDisplayed();
    expect(
      screen.getAllByRole("button", { name: "Not Spam" })[0],
    ).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Publish" })).toBeNull();
    unmount();
    setup({
      category: "published",
      testimonials: [{ ...alice, moderationStatus: "published" }],
    });
    selectDisplayed();
    expect(
      screen.getAllByRole("button", { name: "Unpublish" })[0],
    ).toBeEnabled();
  });
});

it("deduplicates paginated snapshots and excludes new arrivals", async () => {
  const newer = { ...nina, createdAt: Date.now() + 60_000 };
  const load = vi
    .fn()
    .mockResolvedValueOnce(page([alice], false, "next"))
    .mockResolvedValueOnce(page([alice, remy, newer]));
  const result = await collectInboxSelection(load, () => false);
  expect([...result!.keys()]).toEqual([
    alice.testimonialId,
    remy.testimonialId,
  ]);
});
