import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OrganizationOnboardingForm } from "./organization-onboarding-form";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  generateUploadUrl: vi.fn(),
  push: vi.fn(),
  setLogo: vi.fn(),
  uploadProfileImage: vi.fn(),
  useMutation: vi.fn(),
}));

vi.mock("convex/react", () => ({ useMutation: mocks.useMutation }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock("@/lib/upload-profile-image", () => ({
  uploadProfileImage: mocks.uploadProfileImage,
}));
vi.mock("@/components/profile-image/profile-image-control", () => ({
  ProfileImageControl: ({ onUpload }: { onUpload: (blob: Blob) => void }) => (
    <button
      onClick={() => onUpload(new Blob(["logo"], { type: "image/jpeg" }))}
      type="button"
    >
      Stage test logo
    </button>
  ),
}));

describe("OrganizationOnboardingForm", () => {
  beforeEach(() => {
    cleanup();
    mocks.create.mockReset();
    mocks.generateUploadUrl.mockReset();
    mocks.push.mockReset();
    mocks.setLogo.mockReset();
    mocks.uploadProfileImage.mockReset();
    mocks.useMutation.mockReset();
    let mutationCall = 0;
    const mutations = [mocks.create, mocks.generateUploadUrl, mocks.setLogo];
    mocks.useMutation.mockImplementation(
      () => mutations[mutationCall++ % mutations.length],
    );
    mocks.create.mockResolvedValue({
      id: "organization-1",
      slug: "visual-studio-ab12",
    });
    mocks.uploadProfileImage.mockResolvedValue("storage-1");
    mocks.setLogo.mockResolvedValue(null);
  });

  it("uploads an optional staged logo after Organization creation", async () => {
    mocks.generateUploadUrl.mockResolvedValue("https://upload.example");
    render(<OrganizationOnboardingForm />);

    fireEvent.change(screen.getByLabelText("Organization name"), {
      target: { value: "Visual Studio" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Stage test logo" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Create Organization" }),
    );

    await waitFor(() => {
      expect(mocks.setLogo).toHaveBeenCalledWith({
        organizationId: "organization-1",
        storageId: "storage-1",
      });
    });
    expect(mocks.push).toHaveBeenCalledWith(
      "/org/visual-studio-ab12/dashboard",
    );
  });

  it("does not create a duplicate Organization when a logo retry is needed", async () => {
    mocks.generateUploadUrl
      .mockRejectedValueOnce(new Error("Upload unavailable"))
      .mockResolvedValueOnce("https://upload.example");
    render(<OrganizationOnboardingForm />);

    fireEvent.change(screen.getByLabelText("Organization name"), {
      target: { value: "Visual Studio" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Stage test logo" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Create Organization" }),
    );

    expect(
      await screen.findByText(
        "Your Organization was created, but the logo upload failed. Retry or continue without it.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Retry logo and continue" }),
    );

    await waitFor(() => expect(mocks.push).toHaveBeenCalledOnce());
    expect(mocks.create).toHaveBeenCalledOnce();
  });
});
