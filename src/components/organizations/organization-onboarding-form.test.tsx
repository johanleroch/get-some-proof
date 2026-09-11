import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ConvexError } from "convex/values";
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
    mocks.uploadProfileImage.mockResolvedValue({
      storageId: "storage-1",
      metadata: {
        contentType: "image/webp",
        height: 128,
        kind: "brandLogo",
        originalContentType: "image/jpeg",
        originalSize: 4,
        size: 4,
        source: "direct",
        transformVersion: "webp-v1",
        width: 128,
      },
    });
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
    expect(sessionStorage.getItem("get-some-proof-just-created")).toBe("Brand");
  });

  it("reveals an invalid privacy email after its disclosure was collapsed", async () => {
    render(<OrganizationOnboardingForm />);
    fireEvent.change(screen.getByLabelText("Brand name"), {
      target: { value: "Northwind Bakery" },
    });
    const disclosure = screen.getByRole("button", {
      name: "Write your own wording",
    });
    fireEvent.click(disclosure);
    const privacyContact = screen.getByLabelText("Privacy contact");
    fireEvent.change(privacyContact, { target: { value: "invalid-email" } });
    fireEvent.click(disclosure);
    expect(privacyContact).not.toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Create Brand" }));

    await waitFor(() => expect(privacyContact).toHaveFocus());
    expect(privacyContact).toBeVisible();
    expect(privacyContact).toBeInvalid();
    expect(disclosure).toHaveAttribute("aria-expanded", "true");
    expect(
      document.getElementById(disclosure.getAttribute("aria-controls")!),
    ).toContainElement(privacyContact);
    expect(mocks.create).not.toHaveBeenCalled();

    fireEvent.change(privacyContact, {
      target: { value: "privacy@northwind.example" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Brand" }));
    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith(
        expect.objectContaining({
          privacyContact: "privacy@northwind.example",
        }),
      ),
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
        metadata: expect.objectContaining({ kind: "brandLogo" }),
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

  it("says a taken address under its field, opened and focused", async () => {
    mocks.create.mockRejectedValueOnce(
      new ConvexError({
        code: "PUBLIC_SLUG_UNAVAILABLE",
        message: "That public address is already taken. Choose another one.",
      }),
    );
    render(<OrganizationOnboardingForm />);

    fireEvent.change(screen.getByLabelText("Brand name"), {
      target: { value: "Northwind Bakery" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Brand" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "That public address is already taken. Choose another one.",
    );
    const slug = screen.getByLabelText("Public address");
    expect(slug).toHaveAttribute("aria-invalid", "true");
    expect(slug).toHaveValue("northwind-bakery");
    expect(screen.queryByTestId("error-toast-message")).toBeNull();

    fireEvent.change(slug, { target: { value: "northwind-bakery-paris" } });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(slug).not.toHaveAttribute("aria-invalid");
  });
});
