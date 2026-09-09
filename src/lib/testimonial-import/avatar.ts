import type { WallProvider } from "./source";

export const maximumImportAvatarBytes = 5 * 1024 * 1024;

const avatarHosts: Record<WallProvider, ReadonlySet<string>> = {
  "testimonial-to": new Set(["cdn.testimonial.to"]),
  senja: new Set(["senja-io.s3.us-west-1.amazonaws.com", "ik.imagekit.io"]),
};

export class ImportAvatarError extends Error {
  constructor() {
    super("The photo could not be copied. Choose another image and try again.");
    this.name = "ImportAvatarError";
  }
}

export function imageType(bytes: Uint8Array): string | null {
  const starts = (...signature: number[]) =>
    signature.every((value, index) => bytes[index] === value);
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))
    return "image/png";
  const ascii = (from: number, to: number) =>
    String.fromCharCode(...bytes.subarray(from, to));
  if (ascii(0, 6) === "GIF87a" || ascii(0, 6) === "GIF89a") return "image/gif";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

/** Fetch only observed provider image hosts, without credentials or redirects. */
export async function downloadImportAvatar(
  provider: WallProvider,
  input: string,
): Promise<Blob> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new ImportAvatarError();
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !avatarHosts[provider].has(url.hostname)
  )
    throw new ImportAvatarError();

  try {
    const response = await fetch(url, {
      headers: { Accept: "image/jpeg,image/png,image/webp,image/gif" },
      credentials: "omit",
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    const contentType = response.headers.get("content-type")?.split(";")[0];
    if (
      !response.ok ||
      !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
        contentType ?? "",
      ) ||
      Number(response.headers.get("content-length")) > maximumImportAvatarBytes
    ) {
      await response.body?.cancel();
      throw new ImportAvatarError();
    }
    const reader = response.body?.getReader();
    if (!reader) throw new ImportAvatarError();
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maximumImportAvatarBytes) throw new ImportAvatarError();
        chunks.push(new Uint8Array(value));
      }
    } finally {
      await reader.cancel();
      reader.releaseLock();
    }
    const blob = new Blob(chunks, { type: contentType });
    const detected = imageType(
      new Uint8Array(await blob.slice(0, 12).arrayBuffer()),
    );
    if (detected !== contentType) throw new ImportAvatarError();
    return blob;
  } catch {
    throw new ImportAvatarError();
  }
}
