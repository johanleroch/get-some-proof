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
      publicSlug: "visual-studio",
      slug: "visual-studio-ab12",
    });
    mocks.uploadProfileImage.mockResolvedValue("storage-1");
    mocks.setLogo.mockResolvedValue(null);
  });

  it("creates a Brand from the name alone and leaves the wording to the domain", async () => {
    render(<OrganizationOnboardingForm />);

    fireEvent.change(screen.getByLabelText("Brand name"), {
      target: { value: "Northwind Bakery" },
    });
    expect(
      screen.getByText(/Your public address will be \/c\/northwind-bakery\./),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create Brand" }));

    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith({
        collectionFormDescription: undefined,
        collectionFormTitle: undefined,
        name: "Northwind Bakery",
        primaryColor: "#ffbb16",
        privacyContact: undefined,
        publicSlug: "northwind-bakery",
      }),
    );
    expect(mocks.setLogo).not.toHaveBeenCalled();
    expect(mocks.push).toHaveBeenCalledWith(
      "/org/visual-studio-ab12/dashboard",
    );
  });

  it("creates a configured Brand and uploads its optional logo", async () => {
    mocks.generateUploadUrl.mockResolvedValue("https://upload.example");
    render(<OrganizationOnboardingForm />);

    fireEvent.change(screen.getByLabelText("Brand name"), {
      target: { value: "Visual Studio" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    expect(screen.getByLabelText("Public address")).toHaveValue(
      "visual-studio",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Write your own wording" }),
    );
    fireEvent.change(screen.getByLabelText("Collection Form title"), {
      target: { value: "Share your Visual Studio story" },
    });
    fireEvent.change(screen.getByLabelText("Collection Form description"), {
      target: { value: "A short description" },
    });
    fireEvent.change(screen.getByLabelText("Privacy contact"), {
      target: { value: "privacy@visual.example" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Coral" }));
    fireEvent.click(screen.getByRole("button", { name: "Stage test logo" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Brand" }));

    await waitFor(() => {
      expect(mocks.create).toHaveBeenCalledWith({
        collectionFormDescription: "A short description",
        collectionFormTitle: "Share your Visual Studio story",
        name: "Visual Studio",
        primaryColor: "#d9483b",
        privacyContact: "privacy@visual.example",
        publicSlug: "visual-studio",
      });
      expect(mocks.setLogo).toHaveBeenCalledWith({
        organizationId: "organization-1",
        storageId: "storage-1",
      });
    });
    expect(mocks.push).toHaveBeenCalledWith(
      "/org/visual-studio-ab12/dashboard",
    );
  });

  it("does not create a duplicate Brand when a logo retry is needed", async () => {
    mocks.generateUploadUrl
      .mockRejectedValueOnce(new Error("Upload unavailable"))
      .mockResolvedValueOnce("https://upload.example");
    render(<OrganizationOnboardingForm />);

    fireEvent.change(screen.getByLabelText("Brand name"), {
      target: { value: "Visual Studio" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Stage test logo" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Brand" }));

    expect(
      await screen.findByText(
        "Your Brand was created, but the logo upload failed. Retry or continue without it.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Retry logo and continue" }),
    );

    await waitFor(() => expect(mocks.push).toHaveBeenCalledOnce());
    expect(mocks.create).toHaveBeenCalledOnce();
  });
});
