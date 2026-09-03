import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { reorder, setVisibility, useMutation, usePaginatedQuery } = vi.hoisted(
  () => ({
    reorder: vi.fn().mockResolvedValue(null),
    setVisibility: vi.fn().mockResolvedValue(null),
    useMutation: vi.fn(),
    usePaginatedQuery: vi.fn(),
  }),
);

vi.mock("convex/react", () => ({ useMutation, usePaginatedQuery }));

import { PublishedCuration } from "./published-curation";

describe("PublishedCuration", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    usePaginatedQuery.mockReturnValue({
      loadMore: vi.fn(),
      results: [
        {
          submissionType: "text",
          submitterName: "First Person",
          testimonialId: "testimonial-1",
        },
        {
          overrides: { role: true },
          submissionType: "video",
          submitterName: "Second Person",
          testimonialId: "testimonial-2",
        },
      ],
      status: "Exhausted",
    });
    let mutationCall = 0;
    const mutations = [reorder, setVisibility];
    useMutation.mockImplementation(
      () => mutations[mutationCall++ % mutations.length],
    );
  });

  it("offers keyboard-accessible ordering and deterministic overrides", async () => {
    render(<PublishedCuration organizationId={"organization-1" as never} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Move First Person down" }),
    );
    await waitFor(() =>
      expect(reorder).toHaveBeenCalledWith({
        afterTestimonialId: undefined,
        beforeTestimonialId: "testimonial-2",
        organizationId: "organization-1",
        testimonialId: "testimonial-1",
      }),
    );

    fireEvent.change(screen.getByLabelText("Second Person role"), {
      target: { value: "hide" },
    });
    await waitFor(() =>
      expect(setVisibility).toHaveBeenCalledWith({
        organizationId: "organization-1",
        overrides: { role: false },
        testimonialId: "testimonial-2",
      }),
    );
    expect(
      screen.getByRole("button", { name: "Move First Person up" }),
    ).toBeDisabled();
  });

  it("supports pointer drag ordering", async () => {
    render(<PublishedCuration organizationId={"organization-1" as never} />);
    const rendered = screen.getAllByRole("listitem");
    fireEvent.dragStart(rendered[1]!);
    fireEvent.dragOver(rendered[0]!);
    fireEvent.drop(rendered[0]!);
    await waitFor(() =>
      expect(reorder).toHaveBeenCalledWith({
        afterTestimonialId: "testimonial-1",
        beforeTestimonialId: undefined,
        organizationId: "organization-1",
        testimonialId: "testimonial-2",
      }),
    );
  });
});
