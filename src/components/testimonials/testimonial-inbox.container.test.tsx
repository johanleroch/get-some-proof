/**
 * The live wiring of the Inbox: every control of TestimonialInbox against
 * the Convex functions it must call, with convex/react mocked. The fixtures
 * cannot exercise any of this (their callbacks are no-ops), so this is where
 * a wrong function, wrong argument, or a dialog that never opens shows up.
 */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Id } from "@convex/_generated/dataModel";
import { richTextFromPlain } from "@convex/domain/testimonialRichText";

const mocks = vi.hoisted(() => {
  const resolved = () => vi.fn().mockResolvedValue(null);
  return {
    functions: {
      "assistantImports:resumeVideos": resolved(),
      "testimonialImportAvatar:retry": resolved(),
      "testimonialModeration:generatePosterUploadUrl": resolved(),
      "testimonialModeration:markSpam": resolved(),
      "testimonialModeration:remove": resolved(),
      "testimonialModeration:setHighlights": resolved(),
      "testimonialModeration:setPoster": resolved(),
      "testimonialModeration:setStatus": resolved(),
      "testimonialModeration:undoSpam": resolved(),
      "videoMedia:remove": resolved(),
      "wallCustomization:movePublished": resolved(),
      "wallCustomization:setTestimonialVisibility": resolved(),
    } as Record<string, ReturnType<typeof vi.fn>>,
    lists: {} as Record<string, unknown[]>,
    loadMore: vi.fn(),
    paginationStatus: "Exhausted",
    queries: {} as Record<string, unknown>,
    useAction: vi.fn(),
    useMutation: vi.fn(),
    usePaginatedQuery: vi.fn(),
    useQuery: vi.fn(),
  };
});

vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  type Reference = Parameters<typeof getFunctionName>[0];
  const byName = (reference: Reference) => {
    const name = getFunctionName(reference);
    const fn = mocks.functions[name];
    if (!fn) throw new Error(`No mock for Convex function ${name}`);
    return fn;
  };
  mocks.useMutation.mockImplementation(byName);
  mocks.useAction.mockImplementation(byName);
  mocks.useQuery.mockImplementation((reference: Reference, args: unknown) =>
    args === "skip" ? undefined : mocks.queries[getFunctionName(reference)],
  );
  mocks.usePaginatedQuery.mockImplementation(
    (_reference: Reference, args: "skip" | { status: string }) =>
      args === "skip"
        ? { loadMore: mocks.loadMore, results: [], status: "LoadingFirstPage" }
        : {
            loadMore: mocks.loadMore,
            results: mocks.lists[args.status] ?? [],
            status: mocks.paginationStatus,
          },
  );
  return {
    useAction: mocks.useAction,
    useMutation: mocks.useMutation,
    usePaginatedQuery: mocks.usePaginatedQuery,
    useQuery: mocks.useQuery,
  };
});

// Plate selection is covered in real browsers; here the editor is a textarea.
vi.mock("@/components/testimonials/testimonial-editor", () => ({
  TestimonialEditor: ({ id, text }: { id: string; text: string }) => (
    <textarea defaultValue={text} id={id} readOnly />
  ),
}));

vi.mock("@mux/mux-player-react/lazy", async () => {
  const { forwardRef } = await import("react");
  return {
    default: forwardRef<HTMLVideoElement>(function MockMuxPlayer(_, ref) {
      return <video aria-label="Mock video player" ref={ref} />;
    }),
  };
});

import { TestimonialInbox, type InboxTestimonial } from "./testimonial-inbox";

const organizationId = "org_fernhill" as Id<"organizations">;

const alice: InboxTestimonial = {
  card: {
    avatarUrl: null,
    company: "Fernhill Bakery",
    id: "testimonial-alice",
    name: "Alice Martin",
    publishedAt: Date.UTC(2026, 8, 5),
    rating: 5,
    role: "Owner",
    text: "The wall doubled our bookings in a month.",
    type: "text",
  },
  consentAcceptedAt: Date.UTC(2026, 8, 5),
  createdAt: Date.UTC(2026, 8, 5),
  moderationStatus: "pending",
  submissionType: "text",
  submitterEmail: "alice@example.invalid",
  submitterName: "Alice Martin",
  testimonialId: "testimonial-alice" as Id<"testimonials">,
};

const remy: InboxTestimonial = {
  aspectRatio: "9:16",
  card: {
    aspectRatio: "9:16",
    avatarUrl: null,
    captionsAvailable: true,
    id: "testimonial-remy",
    name: "Remy Jupille",
    playbackId: "remy-playback-id",
    posterTimeSeconds: 34,
    publishedAt: Date.UTC(2026, 8, 2),
    rating: 5,
    role: "Founder",
    type: "video",
  },
  captionsStatus: "ready",
  consentAcceptedAt: Date.UTC(2026, 8, 2),
  createdAt: Date.UTC(2026, 8, 2),
  moderationStatus: "pending",
  submissionType: "video",
  submitterEmail: "remy@example.invalid",
  submitterName: "Remy Jupille",
  testimonialId: "testimonial-remy" as Id<"testimonials">,
  videoDurationSeconds: 42,
  videoStatus: "ready",
};

const nora: InboxTestimonial = {
  aspectRatio: "9:16",
  card: null,
  captionsStatus: "requested",
  consentAcceptedAt: Date.UTC(2026, 8, 6),
  createdAt: Date.UTC(2026, 8, 6),
  moderationStatus: "pending",
  submissionType: "video",
  submitterEmail: "nora@example.invalid",
  submitterName: "Nora Lewis",
  testimonialId: "testimonial-nora" as Id<"testimonials">,
  videoStatus: "processing",
};

const suspicious: InboxTestimonial = {
  ...alice,
  card: {
    ...alice.card,
    id: "testimonial-spam",
    name: "Suspicious Submission",
    text: "Buy followers now.",
  },
  moderationStatus: "spam",
  quarantineExpiresAt: Date.UTC(2026, 8, 14),
  submitterEmail: "spam@example.invalid",
  submitterName: "Suspicious Submission",
  testimonialId: "testimonial-spam" as Id<"testimonials">,
};

const remyPublished: InboxTestimonial = {
  ...remy,
  moderationStatus: "published",
};
const alicePublished: InboxTestimonial = {
  ...alice,
  moderationStatus: "published",
  publicVisibilityOverrides: { company: false },
};

function rowOf(testimonial: InboxTestimonial) {
  return within(
    screen.getByTestId(`inbox-testimonial-${testimonial.testimonialId}`),
  );
}

function openMenu(name: string) {
  fireEvent.pointerDown(
    screen.getByRole("button", {
      name: `More actions for ${name}'s Testimonial`,
    }),
    { button: 0, ctrlKey: false },
  );
}

async function chooseMenuItem(name: string, label: string) {
  openMenu(name);
  fireEvent.click(await screen.findByRole("menuitem", { name: label }));
}

/** Radix Tabs switch on mousedown, not on click. */
function goTo(category: RegExp) {
  fireEvent.mouseDown(screen.getByRole("tab", { name: category }), {
    button: 0,
    ctrlKey: false,
  });
}

function calledFunctions(hook: ReturnType<typeof vi.fn>) {
  return hook.mock.calls.map(([reference, args]) => [
    getFunctionName(reference as Parameters<typeof getFunctionName>[0]),
    args,
  ]);
}

function lastListArgs() {
  const calls = mocks.usePaginatedQuery.mock.calls;
  return calls[calls.length - 1]![1];
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, reject, resolve };
}

function successToast() {
  return screen.getByTestId("success-toast-message");
}

describe("TestimonialInbox (live wiring)", () => {
  beforeEach(() => {
    cleanup();
    for (const fn of Object.values(mocks.functions)) {
      fn.mockReset().mockResolvedValue(null);
    }
    mocks.loadMore.mockReset();
    mocks.useAction.mockClear();
    mocks.useMutation.mockClear();
    mocks.usePaginatedQuery.mockClear();
    mocks.useQuery.mockClear();
    mocks.paginationStatus = "Exhausted";
    mocks.queries = {
      "organizations:getBySlug": {
        id: organizationId,
        logoUrl: null,
        name: "Fernhill",
        publicSlug: "fernhill-wall",
        publicSlugCanChange: true,
        slug: "fernhill",
      },
      "testimonialModeration:countInbox": {
        archived: 0,
        pending: 3,
        published: 2,
        spam: 1,
      },
      "wallCustomization:getSettings": {
        accentColor: "#c2410c",
        canHideAttribution: false,
        hideAttribution: false,
        theme: "system",
        transparentEmbed: false,
        visibility: { avatar: true, company: true, rating: false, role: true },
      },
    };
    mocks.lists = {
      archived: [],
      pending: [nora, alice, remy],
      published: [remyPublished, alicePublished],
      spam: [suspicious],
    };
  });

  it("reads the Brand, its counts and its Wall settings, and opens on Pending", () => {
    render(<TestimonialInbox slug="fernhill" />);

    const queries = calledFunctions(mocks.useQuery);
    expect(queries).toContainEqual([
      "organizations:getBySlug",
      { slug: "fernhill" },
    ]);
    expect(queries).toContainEqual([
      "testimonialModeration:countInbox",
      { organizationId },
    ]);
    expect(queries).toContainEqual([
      "wallCustomization:getSettings",
      { organizationId },
    ]);
    expect(calledFunctions(mocks.usePaginatedQuery)).toContainEqual([
      "testimonialModeration:listInbox",
      { organizationId, sort: "newest", status: "pending" },
    ]);
    expect(mocks.usePaginatedQuery).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.anything(),
      { initialNumItems: 20 },
    );

    expect(screen.getByRole("tab", { name: "Pending 3" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Published 2" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Archived" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Spam 1" })).toBeVisible();

    const wall = screen.getByRole("link", { name: "Open Public Wall" });
    expect(wall).toHaveAttribute("href", "/w/fernhill-wall");
    expect(wall).toHaveAttribute("target", "_blank");

    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(rowOf(nora).getByRole("button", { name: "Publish" })).toBeDisabled();
    expect(rowOf(alice).getByRole("button", { name: "Publish" })).toBeEnabled();
    expect(rowOf(remy).getByRole("button", { name: "Publish" })).toBeEnabled();
  });

  it("skips every read and shows the skeleton until the Brand is known", () => {
    mocks.queries["organizations:getBySlug"] = undefined;
    render(<TestimonialInbox slug="fernhill" />);
    expect(screen.queryByRole("heading", { name: "Inbox" })).toBeNull();
    expect(mocks.usePaginatedQuery).toHaveBeenLastCalledWith(
      expect.anything(),
      "skip",
      { initialNumItems: 20 },
    );
    expect(calledFunctions(mocks.useQuery)).toContainEqual([
      "testimonialModeration:countInbox",
      "skip",
    ]);
    expect(calledFunctions(mocks.useQuery)).toContainEqual([
      "wallCustomization:getSettings",
      "skip",
    ]);
  });

  it("lists Published in Wall order and every other category newest first", () => {
    render(<TestimonialInbox slug="fernhill" />);

    goTo(/^Published/);
    expect(lastListArgs()).toEqual({
      organizationId,
      sort: "wall",
      status: "published",
    });
    const rows = screen.getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Remy Jupille");
    expect(rows[1]).toHaveTextContent("Alice Martin");

    goTo(/^Spam/);
    expect(lastListArgs()).toEqual({
      organizationId,
      sort: "newest",
      status: "spam",
    });
    expect(screen.getByText("Suspicious Submission")).toBeVisible();

    goTo(/^Archived/);
    expect(lastListArgs()).toEqual({
      organizationId,
      sort: "newest",
      status: "archived",
    });
    expect(screen.getByText("Nothing Archived")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Go to Pending" }));
    expect(screen.getByRole("tab", { name: "Pending 3" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(lastListArgs()).toEqual({
      organizationId,
      sort: "newest",
      status: "pending",
    });
  });

  it("Publish, Archive and Unpublish write the status", async () => {
    const setStatus = mocks.functions["testimonialModeration:setStatus"]!;
    render(<TestimonialInbox slug="fernhill" />);

    fireEvent.click(rowOf(alice).getByRole("button", { name: "Publish" }));
    await waitFor(() =>
      expect(setStatus).toHaveBeenCalledWith({
        organizationId,
        status: "published",
        testimonialId: alice.testimonialId,
      }),
    );
    await waitFor(() =>
      expect(successToast()).toHaveTextContent(
        "Alice Martin's Testimonial is now published.",
      ),
    );

    fireEvent.click(rowOf(remy).getByRole("button", { name: "Archive" }));
    await waitFor(() =>
      expect(setStatus).toHaveBeenLastCalledWith({
        organizationId,
        status: "archived",
        testimonialId: remy.testimonialId,
      }),
    );
    await waitFor(() =>
      expect(successToast()).toHaveTextContent(
        "Remy Jupille's Testimonial is now archived.",
      ),
    );

    goTo(/^Published/);
    fireEvent.click(
      rowOf(alicePublished).getByRole("button", { name: "Unpublish" }),
    );
    await waitFor(() =>
      expect(setStatus).toHaveBeenLastCalledWith({
        organizationId,
        status: "archived",
        testimonialId: alice.testimonialId,
      }),
    );
    expect(setStatus).toHaveBeenCalledTimes(3);
  });

  it("requires an explicit attestation before publishing imported proof", async () => {
    mocks.lists.pending = [{ ...alice, requiresImportAttestation: true }];
    const setStatus = mocks.functions["testimonialModeration:setStatus"]!;
    render(<TestimonialInbox slug="fernhill" />);
    fireEvent.click(rowOf(alice).getByRole("button", { name: "Publish" }));
    const dialog = screen.getByRole("dialog");
    const publish = within(dialog).getByRole("button", {
      name: "Publish testimonial",
    });
    expect(publish).toBeDisabled();
    expect(setStatus).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("checkbox"));
    fireEvent.click(publish);
    await waitFor(() =>
      expect(setStatus).toHaveBeenCalledWith({
        organizationId,
        testimonialId: alice.testimonialId,
        status: "published",
        importAttestationAccepted: true,
        importAttestationVersion: "2026-09-09",
      }),
    );
  });

  it("Mark as Spam quarantines, Not Spam undoes it", async () => {
    render(<TestimonialInbox slug="fernhill" />);

    await chooseMenuItem("Alice Martin", "Mark as Spam");
    await waitFor(() =>
      expect(
        mocks.functions["testimonialModeration:markSpam"],
      ).toHaveBeenCalledWith({
        organizationId,
        testimonialId: alice.testimonialId,
      }),
    );
    await waitFor(() =>
      expect(successToast()).toHaveTextContent(
        "Testimonial moved to seven-day Spam quarantine.",
      ),
    );

    goTo(/^Spam/);
    fireEvent.click(screen.getByRole("button", { name: "Not Spam" }));
    await waitFor(() =>
      expect(
        mocks.functions["testimonialModeration:undoSpam"],
      ).toHaveBeenCalledWith({
        organizationId,
        testimonialId: suspicious.testimonialId,
      }),
    );
    await waitFor(() =>
      expect(successToast()).toHaveTextContent(
        "Spam report undone. The Testimonial is Pending again.",
      ),
    );
    expect(
      mocks.functions["testimonialModeration:setStatus"],
    ).not.toHaveBeenCalled();
  });

  it("Delete asks first, removes text by the mutation and video by the action", async () => {
    const removeText = mocks.functions["testimonialModeration:remove"]!;
    const removeVideo = mocks.functions["videoMedia:remove"]!;
    render(<TestimonialInbox slug="fernhill" />);

    await chooseMenuItem("Alice Martin", "Delete permanently");
    const dialog = await screen.findByRole("alertdialog", {
      name: "Delete Alice Martin's Testimonial?",
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(removeText).not.toHaveBeenCalled();

    await chooseMenuItem("Alice Martin", "Delete permanently");
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Delete",
      }),
    );
    await waitFor(() =>
      expect(removeText).toHaveBeenCalledWith({
        organizationId,
        testimonialId: alice.testimonialId,
      }),
    );
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(successToast()).toHaveTextContent(
      "Testimonial permanently deleted.",
    );
    expect(removeVideo).not.toHaveBeenCalled();

    await chooseMenuItem("Remy Jupille", "Delete permanently");
    fireEvent.click(
      within(
        await screen.findByRole("alertdialog", {
          name: "Delete Remy Jupille's Testimonial?",
        }),
      ).getByRole("button", { name: "Delete" }),
    );
    await waitFor(() =>
      expect(removeVideo).toHaveBeenCalledWith({
        organizationId,
        testimonialId: remy.testimonialId,
      }),
    );
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(removeText).toHaveBeenCalledTimes(1);
    // The action came from useAction, the mutation from useMutation.
    expect(calledFunctions(mocks.useAction)).toContainEqual([
      "videoMedia:remove",
      undefined,
    ]);
    expect(calledFunctions(mocks.useMutation)).toContainEqual([
      "testimonialModeration:remove",
      undefined,
    ]);
  });

  it("Highlight a phrase opens the dialog on the right words and saves them", async () => {
    const setHighlights =
      mocks.functions["testimonialModeration:setHighlights"]!;
    render(<TestimonialInbox slug="fernhill" />);

    await chooseMenuItem("Alice Martin", "Highlight a phrase");
    const dialog = await screen.findByRole("dialog", {
      name: "Highlight a phrase",
    });
    expect(
      within(dialog).getByDisplayValue(alice.card.text),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByText(/This Testimonial is Published/),
    ).toBeNull();

    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(setHighlights).toHaveBeenCalledWith({
        organizationId,
        richText: richTextFromPlain(alice.card.text),
        testimonialId: alice.testimonialId,
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(successToast()).toHaveTextContent(
      "Alice Martin's Testimonial now has a highlighted phrase.",
    );

    // A video has no phrase to highlight, and a processing video no still.
    openMenu("Remy Jupille");
    expect(
      await screen.findByRole("menuitem", { name: "Change thumbnail" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("menuitem", { name: "Highlight a phrase" }),
    ).toBeNull();
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    openMenu("Nora Lewis");
    expect(
      await screen.findByRole("menuitem", { name: "Delete permanently" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("menuitem", { name: "Change thumbnail" }),
    ).toBeNull();
  });

  it("Change thumbnail opens the dialog on the Ready video and saves a moment", async () => {
    const setPoster = mocks.functions["testimonialModeration:setPoster"]!;
    render(<TestimonialInbox slug="fernhill" />);

    await chooseMenuItem("Remy Jupille", "Change thumbnail");
    const dialog = await screen.findByRole("dialog", {
      name: "Choose a thumbnail",
    });
    // Eight moments across the 42-second video.
    expect(within(dialog).getAllByRole("radio")).toHaveLength(8);
    fireEvent.click(
      within(dialog).getByRole("radio", { name: "Moment at 0:29" }),
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(setPoster).toHaveBeenCalledWith({
        organizationId,
        poster: { kind: "frame", timeSeconds: 29 },
        testimonialId: remy.testimonialId,
      }),
    );
    expect(
      mocks.functions["testimonialModeration:generatePosterUploadUrl"],
    ).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(successToast()).toHaveTextContent(
      "Remy Jupille's video has a new thumbnail.",
    );
  });

  it("the still opens the playable card, and the dialog closes by X and Escape", async () => {
    render(<TestimonialInbox slug="fernhill" />);
    expect(screen.queryByTestId("mux-video-player")).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Preview Remy Jupille's video" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Remy Jupille’s video",
    });
    expect(
      within(dialog).getByRole("button", {
        name: "Play Remy Jupille's testimonial",
      }),
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    fireEvent.click(
      screen.getByRole("button", { name: "Preview Remy Jupille's video" }),
    );
    const reopened = await screen.findByRole("dialog", {
      name: "Remy Jupille’s video",
    });
    fireEvent.keyDown(reopened, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("Show or hide details saves the overrides, and keeps the dialog on an error", async () => {
    const setVisibility =
      mocks.functions["wallCustomization:setTestimonialVisibility"]!;
    render(<TestimonialInbox slug="fernhill" />);
    goTo(/^Published/);

    await chooseMenuItem("Alice Martin", "Show or hide details");
    const dialog = await screen.findByRole("dialog", {
      name: "Details on Alice Martin’s card",
    });
    // The Wall settings read from Convex decide the defaults shown.
    expect(within(dialog).getByText("Stars")).toHaveTextContent(
      "hidden by default",
    );
    const company = within(dialog).getByRole("group", { name: "Company" });
    expect(
      within(company).getByRole("button", { name: "Hide" }),
    ).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(
      within(within(dialog).getByRole("group", { name: "Stars" })).getByRole(
        "button",
        { name: "Show" },
      ),
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(setVisibility).toHaveBeenCalledWith({
        organizationId,
        overrides: { company: false, rating: true },
        testimonialId: alice.testimonialId,
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(successToast()).toHaveTextContent(
      "What Alice Martin's card shows is live on your Public Wall.",
    );

    setVisibility.mockRejectedValueOnce(new Error("The Wall is locked."));
    await chooseMenuItem("Alice Martin", "Show or hide details");
    const again = await screen.findByRole("dialog", {
      name: "Details on Alice Martin’s card",
    });
    fireEvent.click(within(again).getByRole("button", { name: "Save" }));
    expect(await within(again).findByRole("alert")).toHaveTextContent(
      "The Wall is locked.",
    );
    expect(screen.getByRole("dialog")).toBeVisible();
    fireEvent.click(within(again).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("moving a Published row writes who sits above and below", async () => {
    const movePublished = mocks.functions["wallCustomization:movePublished"]!;
    render(<TestimonialInbox slug="fernhill" />);
    goTo(/^Published/);

    expect(
      screen.getByRole("button", { name: "Move Remy Jupille up" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Move Alice Martin down" }),
    ).toBeDisabled();

    fireEvent.click(
      screen.getByRole("button", { name: "Move Remy Jupille down" }),
    );
    await waitFor(() =>
      expect(movePublished).toHaveBeenCalledWith({
        afterTestimonialId: undefined,
        beforeTestimonialId: alice.testimonialId,
        organizationId,
        testimonialId: remy.testimonialId,
      }),
    );
    await waitFor(() =>
      expect(successToast()).toHaveTextContent("Public Wall order saved."),
    );

    const rows = screen.getAllByRole("listitem");
    fireEvent.dragStart(rows[1]!);
    fireEvent.dragOver(rows[0]!);
    fireEvent.drop(rows[0]!);
    await waitFor(() =>
      expect(movePublished).toHaveBeenLastCalledWith({
        afterTestimonialId: remy.testimonialId,
        beforeTestimonialId: undefined,
        organizationId,
        testimonialId: alice.testimonialId,
      }),
    );
  });

  it("Load more asks for twenty more, only while there are more", () => {
    mocks.paginationStatus = "CanLoadMore";
    const { rerender } = render(<TestimonialInbox slug="fernhill" />);

    fireEvent.click(
      screen.getByRole("button", { name: "Load more Testimonials" }),
    );
    expect(mocks.loadMore).toHaveBeenCalledWith(20);

    mocks.paginationStatus = "Exhausted";
    rerender(<TestimonialInbox slug="fernhill" />);
    expect(
      screen.queryByRole("button", { name: "Load more Testimonials" }),
    ).toBeNull();
  });

  it("a failed action tells the Owner and frees the row", async () => {
    const setStatus = mocks.functions["testimonialModeration:setStatus"]!;
    setStatus.mockRejectedValueOnce(
      new Error("Reactivate Pro before republishing this retained video."),
    );
    render(<TestimonialInbox slug="fernhill" />);

    fireEvent.click(rowOf(remy).getByRole("button", { name: "Publish" }));
    await waitFor(() =>
      expect(screen.getByTestId("error-toast-message")).toHaveTextContent(
        "Reactivate Pro before republishing this retained video.",
      ),
    );
    expect(screen.queryByTestId("success-toast-message")).toBeNull();
    expect(rowOf(remy).getByRole("button", { name: "Publish" })).toBeEnabled();
    expect(
      screen.getByTestId(`inbox-testimonial-${remy.testimonialId}`),
    ).not.toHaveAttribute("aria-busy");

    // The next success clears the error.
    fireEvent.click(rowOf(alice).getByRole("button", { name: "Publish" }));
    await waitFor(() =>
      expect(successToast()).toHaveTextContent(
        "Alice Martin's Testimonial is now published.",
      ),
    );
    expect(screen.queryByTestId("error-toast-message")).toBeNull();
  });

  it("acts on one Testimonial at a time, and says which one", async () => {
    mocks.paginationStatus = "CanLoadMore";
    const setStatus = mocks.functions["testimonialModeration:setStatus"]!;
    const pending = deferred<null>();
    setStatus.mockReturnValueOnce(pending.promise);
    render(<TestimonialInbox slug="fernhill" />);

    fireEvent.click(rowOf(alice).getByRole("button", { name: "Publish" }));

    const aliceRow = screen.getByTestId(
      `inbox-testimonial-${alice.testimonialId}`,
    );
    await waitFor(() => expect(aliceRow).toHaveAttribute("aria-busy", "true"));
    expect(
      rowOf(alice).getByRole("button", { name: "Publish" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(
      rowOf(alice).getByRole("button", { name: "Archive" }),
    ).toBeDisabled();
    expect(rowOf(remy).getByRole("button", { name: "Publish" })).toBeDisabled();
    expect(rowOf(remy).getByRole("button", { name: "Archive" })).toBeDisabled();
    expect(
      rowOf(remy).getByRole("button", {
        name: "More actions for Remy Jupille's Testimonial",
      }),
    ).toBeDisabled();
    expect(
      screen.getByTestId(`inbox-testimonial-${remy.testimonialId}`),
    ).not.toHaveAttribute("aria-busy");
    expect(
      screen.getByRole("button", { name: "Load more Testimonials" }),
    ).toBeDisabled();
    expect(setStatus).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve(null);
      await pending.promise;
    });

    await waitFor(() => expect(aliceRow).not.toHaveAttribute("aria-busy"));
    expect(rowOf(remy).getByRole("button", { name: "Publish" })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Load more Testimonials" }),
    ).toBeEnabled();
    expect(successToast()).toHaveTextContent(
      "Alice Martin's Testimonial is now published.",
    );
  });
  it("scopes the Inbox list and counts to the import and offers the complete Inbox", () => {
    render(<TestimonialInbox slug="fernhill" importJobId="job-june" />);
    expect(mocks.usePaginatedQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ importJobId: "job-june", organizationId }),
      { initialNumItems: 20 },
    );
    expect(mocks.useQuery).toHaveBeenCalledWith(expect.anything(), {
      importJobId: "job-june",
      organizationId,
    });
    expect(
      screen.getByText("Showing testimonials from this import."),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Show all testimonials" }),
    ).toHaveAttribute("href", "/org/fernhill/inbox");
    goTo(/Published/);
    expect(mocks.usePaginatedQuery).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        importJobId: "job-june",
        status: "published",
        sort: "wall",
      }),
      { initialNumItems: 20 },
    );
    expect(
      screen.queryByRole("button", { name: /Move.*up/i }),
    ).not.toBeInTheDocument();
  });
});
