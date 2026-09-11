import { renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { Id } from "@convex/_generated/dataModel";
import type { InboxTestimonial } from "./testimonial-inbox";
import { useBulkInboxActions } from "./use-bulk-inbox-actions";

const mocks = vi.hoisted(() => ({
  remove: vi.fn().mockResolvedValue({ deleted: true }),
  mutate: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useConvex: () => ({ query: vi.fn() }),
  useMutation: () => mocks.mutate,
  useAction: () => mocks.remove,
}));

it("routes bulk text and video deletion through confirmed media cleanup", async () => {
  const organizationId = "project" as Id<"organizations">;
  const { result } = renderHook(() =>
    useBulkInboxActions({ organizationId, category: "pending" }),
  );
  for (const submissionType of ["text", "video"] as const) {
    const testimonialId = submissionType as Id<"testimonials">;
    await result.current.perform(
      { testimonialId, submissionType } as InboxTestimonial,
      "delete",
      false,
    );
    expect(mocks.remove).toHaveBeenCalledWith({
      organizationId,
      testimonialId,
    });
  }
  expect(mocks.remove).toHaveBeenCalledTimes(2);
  expect(mocks.mutate).not.toHaveBeenCalled();
});
