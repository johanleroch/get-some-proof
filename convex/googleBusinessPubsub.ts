import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

export const receive = httpAction(async (ctx, request) => {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer "))
    return new Response(null, { status: 401 });
  const jwt = authorization.slice(7);
  if (jwt.length > 8192) return new Response(null, { status: 413 });
  const reader = request.body?.getReader();
  if (!reader) return new Response(null, { status: 400 });
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > 16384) {
        await reader.cancel();
        return new Response(null, { status: 413 });
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  const data = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const status = await ctx.runAction(
    internal.googleBusinessPubsubActions.ingest,
    { jwt, body: new TextDecoder().decode(data) },
  );
  return new Response(null, { status });
});
