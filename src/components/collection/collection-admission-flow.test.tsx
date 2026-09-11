import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({
  issue: vi.fn(),
  allocate: vi.fn(),
  register: vi.fn(),
  submit: vi.fn(),
}));
vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  const functions: Record<string, unknown> = {
    "collectionAdmission:create": calls.issue,
    "testimonialImages:generateUploadUrl": calls.allocate,
    "testimonialImages:registerUpload": calls.register,
    "submissions:submitText": calls.submit,
  };
  return {
    useQuery: (ref: Parameters<typeof getFunctionName>[0]) =>
      getFunctionName(ref) === "organizations:getByPublicSlug"
        ? {
            collectionFormDescription: "Tell us what changed.",
            collectionFormTitle: "Share your story",
            logoUrl: null,
            name: "Mira Studio",
            primaryColor: "#123abc",
            privacyContact: "privacy@example.com",
            publicSlug: "mira-studio",
          }
        : { textAvailable: true, videoAvailable: true },
    useAction: (ref: Parameters<typeof getFunctionName>[0]) =>
      functions[getFunctionName(ref)] ?? vi.fn(),
    useMutation: (ref: Parameters<typeof getFunctionName>[0]) =>
      functions[getFunctionName(ref)] ?? vi.fn(),
  };
});
vi.mock("@/components/collection/turnstile-challenge", () => ({
  TurnstileChallenge: ({ onToken }: { onToken: (token: string) => void }) => (
    <button type="button" onClick={() => onToken("verified-challenge")}>
      Complete verification
    </button>
  ),
}));
vi.mock("@/components/testimonials/testimonial-editor", () => ({
  TestimonialEditor: ({
    id,
    text,
    onChange,
  }: {
    id: string;
    text: string;
    onChange: (text: string, value: unknown) => void;
  }) => (
    <textarea
      id={id}
      value={text}
      onChange={(event) =>
        onChange(event.target.value, [
          { type: "p", children: [{ text: event.target.value }] },
        ])
      }
    />
  ),
}));
vi.mock("@/lib/upload-profile-image", () => ({
  uploadProfileImage: vi.fn().mockResolvedValue({
    storageId: "storage-fixture",
    metadata: {
      contentType: "image/webp",
      height: 720,
      kind: "testimonialImage",
      originalContentType: "image/png",
      originalSize: 9,
      size: 9,
      source: "direct",
      transformVersion: "webp-v1",
      width: 960,
    },
  }),
}));
import { CollectionFormShell } from "./collection-form-shell";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("shares one verified admission across attachments and final submission", async () => {
  calls.issue.mockResolvedValue({
    token: "a".repeat(64),
    expiresAt: Date.now() + 600_000,
  });
  calls.allocate.mockResolvedValue({
    imageId: "image-fixture",
    uploadUrl: "https://storage.example/upload",
  });
  calls.register.mockResolvedValue({
    id: "image-fixture",
    url: "https://storage.example/image",
  });
  calls.submit.mockResolvedValue({
    moderationStatus: "pending",
    testimonialId: "testimonial-fixture",
  });
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(Response.json({ storageId: "storage-fixture" })),
      ),
  );
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL() {
        return "blob:fixture";
      }
      static revokeObjectURL() {}
    },
  );
  render(<CollectionFormShell publicSlug="mira-studio" />);
  fireEvent.click(
    screen.getByRole("button", { name: "Send a text testimonial" }),
  );
  fireEvent.change(screen.getByLabelText("Your testimonial"), {
    target: {
      value:
        "We spend more time with customers and less time chasing paperwork.",
    },
  });
  fireEvent.change(screen.getByLabelText("Attach testimonial images"), {
    target: {
      files: [
        new File(["image-one"], "proof-one.png", { type: "image/png" }),
        new File(["image-two"], "proof-two.png", { type: "image/png" }),
      ],
    },
  });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  fireEvent.change(screen.getByLabelText("Your name"), {
    target: { value: "Mira" },
  });
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "mira@example.com" },
  });
  fireEvent.click(screen.getByLabelText(/at least 18 years old/i));
  fireEvent.click(screen.getByLabelText(/I give Publication Consent/i));
  fireEvent.click(
    screen.getByRole("button", { name: "Complete verification" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Submit testimonial" }));
  await waitFor(() => expect(calls.submit).toHaveBeenCalledOnce());
  expect(calls.issue).toHaveBeenCalledOnce();
  expect(calls.issue).toHaveBeenCalledWith(
    expect.objectContaining({
      publicSlug: "mira-studio",
      turnstileToken: "verified-challenge",
    }),
  );
  expect(calls.allocate).toHaveBeenCalledTimes(2);
  expect(
    calls.allocate.mock.calls.every(
      ([args]) => args.admissionToken === "a".repeat(64),
    ),
  ).toBe(true);
  expect(calls.submit).toHaveBeenCalledWith(
    expect.objectContaining({
      admissionToken: "a".repeat(64),
      turnstileToken: undefined,
    }),
  );
});
