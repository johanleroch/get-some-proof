import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { request as httpRequest, type IncomingMessage } from "node:http";
import { request as httpsRequest } from "node:https";
import { imageType, maximumImportAvatarBytes } from "./avatar";

const blocked = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 3],
] as const)
  blocked.addSubnet(address, prefix, "ipv4");
const publicV6 = new BlockList();
publicV6.addSubnet("2000::", 3, "ipv6");
blocked.addSubnet("2001::", 23, "ipv6");
blocked.addSubnet("2001:db8::", 32, "ipv6");
blocked.addSubnet("2002::", 16, "ipv6");
blocked.addSubnet("3fff::", 20, "ipv6");

export class MediaCopyError extends Error {
  constructor(
    readonly transient = false,
    readonly diagnostic?: string,
  ) {
    super(
      "The media could not be copied. Check the source or choose a replacement file.",
    );
  }
}

function publicAddress(address: string, family: number) {
  return family === 4
    ? !blocked.check(address, "ipv4")
    : family === 6 &&
        publicV6.check(address, "ipv6") &&
        !blocked.check(address, "ipv6");
}

export async function openPublicMedia(
  input: string,
  signal: AbortSignal,
  accept = "image/jpeg,image/png,image/webp,image/gif",
): Promise<IncomingMessage> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new MediaCopyError();
  }
  for (let hop = 0; hop <= 3; hop++) {
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.port ||
      url.href.length > 2048
    )
      throw new MediaCopyError();
    const hostname = url.hostname.replace(/^\[|\]$/g, "");
    if (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      (!hostname.includes(".") && !isIP(hostname))
    )
      throw new MediaCopyError();
    const addresses = isIP(hostname)
      ? [{ address: hostname, family: isIP(hostname) }]
      : await Promise.race([
          lookup(hostname, { all: true }).catch(
            (error: NodeJS.ErrnoException) => {
              throw new MediaCopyError(
                error.code === "EAI_AGAIN" || error.code === "ETIMEOUT",
              );
            },
          ),
          new Promise<never>((_, reject) =>
            signal.addEventListener(
              "abort",
              () => reject(new MediaCopyError(true)),
              { once: true },
            ),
          ),
        ]);
    if (
      !addresses.length ||
      addresses.some(({ address, family }) => !publicAddress(address, family))
    )
      throw new MediaCopyError();
    signal.throwIfAborted();
    const pinned = addresses[0];
    const response = await new Promise<IncomingMessage>((resolve, reject) => {
      const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(
        url,
        {
          agent: false,
          signal,
          family: pinned.family,
          lookup: (_host, _options, callback) =>
            callback(null, pinned.address, pinned.family),
          headers: {
            Accept: accept,
            "Accept-Encoding": "identity",
          },
        },
        resolve,
      );
      request.on("error", () => reject(new MediaCopyError(true)));
      request.end();
    });
    if ([301, 302, 303, 307, 308].includes(response.statusCode ?? 0)) {
      response.destroy();
      if (!response.headers.location || hop === 3) throw new MediaCopyError();
      url = new URL(response.headers.location, url);
      continue;
    }
    if (response.statusCode !== 200) {
      response.destroy();
      throw new MediaCopyError(
        response.statusCode === 429 || (response.statusCode ?? 0) >= 500,
      );
    }
    return response;
  }
  throw new MediaCopyError();
}

/** Public DNS destinations are checked on each redirect and pinned for the socket. */
export async function downloadPublicPortrait(input: string): Promise<Blob> {
  const response = await openPublicMedia(input, AbortSignal.timeout(15_000));
  try {
    const contentType = response.headers["content-type"]?.split(";")[0];
    if (
      !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
        contentType ?? "",
      ) ||
      Number(response.headers["content-length"]) > maximumImportAvatarBytes ||
      (response.headers["content-encoding"] &&
        response.headers["content-encoding"] !== "identity")
    )
      throw new MediaCopyError();
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let length = 0;
    for await (const chunk of response) {
      length += chunk.length;
      if (length > maximumImportAvatarBytes) throw new MediaCopyError();
      chunks.push(new Uint8Array(chunk));
    }
    const blob = new Blob(chunks, { type: contentType });
    if (
      !length ||
      imageType(new Uint8Array(await blob.slice(0, 12).arrayBuffer())) !==
        contentType
    )
      throw new MediaCopyError();
    return blob;
  } catch (error) {
    if (error instanceof MediaCopyError) throw error;
    throw new MediaCopyError(true);
  } finally {
    response.destroy();
  }
}
