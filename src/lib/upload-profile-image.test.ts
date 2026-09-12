import { afterEach, expect, it, vi } from "vitest";
import type { Id } from "@convex/_generated/dataModel";
import { uploadProfileImage } from "./upload-profile-image";
import { optimizeImageForUpload } from "./image-assets";
vi.mock("./image-assets", () => ({ optimizeImageForUpload: vi.fn() }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.resetAllMocks();
});
it("recovers an action connection loss using a fresh upload, not a possibly consumed temporary file", async () => {
  vi.useFakeTimers();
  const blob = new Blob(["image"], { type: "image/webp" });
  const metadata = { kind: "ownerPhoto", source: "direct" } as const;
  vi.mocked(optimizeImageForUpload).mockResolvedValue({
    blob,
    metadata,
  } as Awaited<ReturnType<typeof optimizeImageForUpload>>);
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ storageId: "temporary-1" }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ storageId: "temporary-2" }),
    });
  vi.stubGlobal("fetch", fetchMock);
  const result = {
    storageId: "verified" as Id<"_storage">,
    verificationId: "verification" as Id<"directImageVerifications">,
    metadata,
  };
  const processImage = vi
    .fn()
    .mockRejectedValueOnce(
      new Error(
        "[CONVEX A(imageAssetProcessing:processDirectUpload)] Connection lost while action was in flight Called by client",
      ),
    )
    .mockResolvedValueOnce(result);
  const promise = uploadProfileImage(
    blob,
    "https://upload.example",
    "ownerPhoto",
    processImage,
    { kind: "ownerPhoto" },
  );
  const [, value] = await Promise.all([vi.runAllTimersAsync(), promise]);
  expect(value).toEqual(result);
  expect(
    processImage.mock.calls.map(([args]) => args.temporaryStorageId),
  ).toEqual(["temporary-1", "temporary-2"]);
  expect(optimizeImageForUpload).toHaveBeenCalledTimes(1);
});

it.each([true, false])(
  "bounds retries and preserves non-network errors (connection loss: %s)",
  async (connectionLoss) => {
    vi.useFakeTimers();
    const blob = new Blob(["image"], { type: "image/webp" });
    vi.mocked(optimizeImageForUpload).mockResolvedValue({
      blob,
      metadata: { kind: "ownerPhoto", source: "direct" },
    } as Awaited<ReturnType<typeof optimizeImageForUpload>>);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ storageId: "temporary" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const failure = new Error(
      connectionLoss
        ? "Connection lost while action was in flight"
        : "INVALID_IMAGE_METADATA",
    );
    const processImage = vi.fn().mockRejectedValue(failure);
    const outcome = uploadProfileImage(
      blob,
      "https://upload.example",
      "ownerPhoto",
      processImage,
      { kind: "ownerPhoto" },
    ).catch((error) => error);
    await vi.runAllTimersAsync();
    const error = await outcome;
    expect(fetchMock).toHaveBeenCalledTimes(connectionLoss ? 3 : 1);
    expect(processImage).toHaveBeenCalledTimes(connectionLoss ? 3 : 1);
    if (connectionLoss) {
      expect(error.message).toBe(
        "Connection interrupted while preparing an image. Check your connection and try again.",
      );
      expect(error.cause).toBe(failure);
    } else expect(error).toBe(failure);
  },
);
