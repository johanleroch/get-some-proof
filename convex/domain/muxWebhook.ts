const toleranceSeconds = 5 * 60;

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index]! ^ right[index]!;
  }
  return difference === 0;
}

function hexBytes(value: string) {
  if (!/^[a-f0-9]{64}$/i.test(value)) return null;
  return Uint8Array.from(value.match(/.{2}/g) ?? [], (byte) =>
    Number.parseInt(byte, 16),
  );
}

export async function verifyMuxSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1_000),
) {
  if (!signatureHeader) return false;
  let timestamp: number | undefined;
  const signatures: string[] = [];
  for (const part of signatureHeader.split(",")) {
    const [key, value] = part.trim().split("=", 2);
    if (key === "t" && value) timestamp = Number(value);
    if (key === "v1" && value) signatures.push(value);
  }
  if (
    !Number.isSafeInteger(timestamp) ||
    Math.abs(nowSeconds - timestamp!) > toleranceSeconds
  ) {
    return false;
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const expected = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${timestamp}.${rawBody}`),
    ),
  );
  return signatures.some((signature) => {
    const received = hexBytes(signature);
    return received !== null && constantTimeEqual(received, expected);
  });
}

export type MuxVideoEvent = {
  data: unknown;
  id: string;
  type: string;
};

export function isMuxVideoEvent(value: unknown): value is MuxVideoEvent {
  if (value === null || typeof value !== "object" || !("data" in value)) {
    return false;
  }
  const event = value as { id?: unknown; type?: unknown };
  return (
    typeof event.id === "string" &&
    event.id.length > 0 &&
    event.id.length <= 200 &&
    typeof event.type === "string" &&
    event.type.length > 0 &&
    event.type.length <= 100
  );
}
