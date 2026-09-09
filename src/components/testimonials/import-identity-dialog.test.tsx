import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Doc } from "@convex/_generated/dataModel";
import { ImportIdentityDialog } from "./import-identity-dialog";

vi.mock("@/components/profile-image/profile-image-control", () => ({
  ProfileImageControl: ({
    onUpload,
    onRemove,
  }: {
    onUpload: (blob: Blob) => Promise<void>;
    onRemove: () => Promise<void>;
  }) => (
    <>
      <button
        type="button"
        onClick={() =>
          void onUpload(new Blob(["photo"], { type: "image/jpeg" }))
        }
      >
        Choose photo
      </button>
      <button type="button" onClick={() => void onRemove()}>
        Remove photo
      </button>
    </>
  ),
}));
const item = {
  authorName: "Camille Laurent",
  tagline: "Potter",
} as Doc<"testimonialImportItems">;
beforeEach(() => {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:photo-draft");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it.each(["Choose photo", "Remove photo"])(
  "Cancel discards %s without an upload or identity mutation",
  async (name) => {
    const onPhoto = vi.fn();
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(
      <ImportIdentityDialog
        item={item}
        onPhoto={onPhoto}
        onSave={onSave}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onPhoto).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  },
);

it("saves the draft photo only on explicit Save details", async () => {
  const onPhoto = vi.fn().mockResolvedValue(null);
  const onSave = vi.fn().mockResolvedValue(null);
  render(
    <ImportIdentityDialog
      item={item}
      onPhoto={onPhoto}
      onSave={onSave}
      onClose={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Choose photo" }));
  expect(onPhoto).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Save details" }));
  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith({
      authorName: "Camille Laurent",
      tagline: "Potter",
    }),
  );
  expect(onPhoto).toHaveBeenCalledWith(expect.any(Blob));
});
