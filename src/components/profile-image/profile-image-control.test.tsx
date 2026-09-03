import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProfileImageControl } from "./profile-image-control";

vi.mock("react-easy-crop", () => ({
  default: ({
    onCropComplete,
  }: {
    onCropComplete: (
      area: { height: number; width: number; x: number; y: number },
      pixels: { height: number; width: number; x: number; y: number },
    ) => void;
  }) => (
    <button
      data-testid="cropper"
      onClick={() =>
        onCropComplete(
          { height: 100, width: 100, x: 0, y: 0 },
          { height: 100, width: 100, x: 0, y: 0 },
        )
      }
      type="button"
    >
      Mark crop
    </button>
  ),
}));

describe("ProfileImageControl", () => {
  let objectUrlCount = 0;

  beforeEach(() => {
    cleanup();
    objectUrlCount = 0;
    vi.spyOn(URL, "createObjectURL").mockImplementation(
      () => `blob:preview-${objectUrlCount++}`,
    );
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  });

  it("reveals the image edit action on hover or keyboard focus", () => {
    render(
      <ProfileImageControl
        alt="Johan"
        cropShape="round"
        fallback="JL"
        imageUrl="https://example.com/avatar.jpg"
        label="Profile picture"
        onRemove={vi.fn()}
        onUpload={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Edit profile picture" }),
    ).toHaveClass(
      "pointer-events-none",
      "opacity-0",
      "group-hover:pointer-events-auto",
      "group-hover:opacity-100",
      "focus-visible:pointer-events-auto",
      "focus-visible:opacity-100",
    );
  });

  it("opens a crop dialog after a valid image is chosen", async () => {
    render(
      <ProfileImageControl
        alt="Johan"
        cropShape="round"
        fallback="JL"
        imageUrl={null}
        label="Profile picture"
        onRemove={vi.fn()}
        onUpload={vi.fn()}
      />,
    );

    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: {
        files: [new File(["image"], "avatar.jpg", { type: "image/jpeg" })],
      },
    });

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Edit profile picture")).toBeInTheDocument();
    expect(screen.getByTestId("cropper")).toBeInTheDocument();
  });

  it("rejects a non-image before opening the crop dialog", async () => {
    render(
      <ProfileImageControl
        alt="Johan"
        cropShape="round"
        fallback="JL"
        imageUrl={null}
        label="Profile picture"
        onRemove={vi.fn()}
        onUpload={vi.fn()}
      />,
    );

    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: {
        files: [new File(["text"], "notes.txt", { type: "text/plain" })],
      },
    });

    expect(
      await screen.findByText(
        "Choose a PNG, JPG, or WebP image smaller than 5 MB.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("removes an existing image explicitly", async () => {
    const onRemove = vi.fn().mockResolvedValue(undefined);
    render(
      <ProfileImageControl
        alt="Johan"
        cropShape="round"
        fallback="JL"
        imageUrl="https://example.com/avatar.jpg"
        label="Profile picture"
        onRemove={onRemove}
        onUpload={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /remove/i }));
    await waitFor(() => expect(onRemove).toHaveBeenCalledOnce());
  });

  it("requires a fresh crop after choosing a different image", async () => {
    render(
      <ProfileImageControl
        alt="Johan"
        cropShape="round"
        fallback="JL"
        imageUrl={null}
        label="Profile picture"
        onRemove={vi.fn()}
        onUpload={vi.fn()}
      />,
    );
    const input = document.querySelector('input[type="file"]')!;

    fireEvent.change(input, {
      target: {
        files: [new File(["first"], "first.jpg", { type: "image/jpeg" })],
      },
    });
    fireEvent.click(await screen.findByRole("button", { name: "Mark crop" }));
    expect(
      screen.getByRole("button", { name: "Set new picture" }),
    ).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    fireEvent.change(input, {
      target: {
        files: [new File(["second"], "second.jpg", { type: "image/jpeg" })],
      },
    });
    expect(
      await screen.findByRole("button", { name: "Set new picture" }),
    ).toBeDisabled();
  });
});
