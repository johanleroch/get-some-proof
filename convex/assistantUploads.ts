import { getOrganizationBillingEntitlement } from "./billingEntitlements";
import { ConvexError, v, type Infer } from "convex/values";
import {
  action,
  internalAction,
  internalMutation,
  httpAction,
  env,
  type MutationCtx,
  type ActionCtx,
} from "./_generated/server";
import { internal, components } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { importGrant, requireImportPrincipal } from "./importOAuthCommands";
import { requirePaidAssistant } from "./assistantImports";
import { requireVerifiedPrincipal, type Principal } from "./security/principal";
import { requireOrganizationPermissionForPrincipal } from "./security/organizationAccess";
import { hashSubmissionManagementToken } from "./domain/submission";
import {
  retryOwnedImportVideo,
  failCopyRecord,
} from "./testimonialImportVideo";
import { createVideoDirectUpload } from "./videoProvider";

const chunkSize = 8 * 1024 * 1024;
const maximumBytes = 512 * 1024 * 1024;
const uploadArgs = {
  jobId: v.id("testimonialImportJobs"),
  itemId: v.id("testimonialImportItems"),
  requestId: v.string(),
  totalBytes: v.number(),
  mimeType: v.string(),
};
const capability = v.object({
  status: v.union(
    v.literal("uploading"),
    v.literal("finalizing"),
    v.literal("complete"),
  ),
  uploadUrl: v.string(),
  uploadToken: v.string(),
  expiresAt: v.number(),
  offset: v.number(),
  chunkSize: v.number(),
  totalBytes: v.number(),
});

export const prepare = internalMutation({
  args: { ...uploadArgs, grant: v.optional(importGrant) },
  returns: v.object({
    id: v.id("assistantImportUploads"),
    assetId: v.id("videoAssets"),
    reservationId: v.id("videoReservations"),
    organizationId: v.id("organizations"),
    create: v.boolean(),
    capability,
  }),
  handler: async (ctx, args) => {
    const principal = args.grant
      ? await requireImportPrincipal(ctx, args.grant)
      : await requireVerifiedPrincipal(ctx);
    const job = await ctx.db.get(args.jobId);
    const item = await ctx.db.get(args.itemId);
    if (
      !job ||
      job.provider !== "assistant" ||
      job.createdBy !== principal.actorId ||
      !item ||
      item.jobId !== job._id ||
      item.type !== "video"
    )
      throw new ConvexError("Import unavailable.");
    await requireOrganizationPermissionForPrincipal(
      ctx,
      { organizationId: job.organizationId },
      "ownership:manage",
      principal,
    );
    if (
      !Number.isSafeInteger(args.totalBytes) ||
      args.totalBytes <= 0 ||
      args.totalBytes > maximumBytes ||
      !["video/mp4", "video/quicktime", "video/webm"].includes(args.mimeType) ||
      !args.requestId.trim() ||
      args.requestId.length > 128
    )
      throw new ConvexError(
        "Choose an MP4, MOV or WebM file no larger than 512 MB.",
      );
    const existing = await ctx.db
      .query("assistantImportUploads")
      .withIndex("by_itemId_and_requestId", (q) =>
        q.eq("itemId", item._id).eq("requestId", args.requestId),
      )
      .unique();
    const asCapability = (upload: Doc<"assistantImportUploads">) => ({
      status:
        upload.status === "preparing"
          ? ("uploading" as const)
          : upload.status === "failed"
            ? ("uploading" as const)
            : upload.status,
      uploadUrl: `${env.CONVEX_SITE_URL}/api/import-mcp/upload`,
      uploadToken: upload.token,
      expiresAt: upload.expiresAt,
      offset: upload.offset,
      chunkSize,
      totalBytes: upload.totalBytes,
    });
    if (existing) {
      if (existing.grant) await requireImportPrincipal(ctx, existing.grant);
      if (
        existing.actorId !== principal.actorId ||
        existing.totalBytes !== args.totalBytes ||
        existing.mimeType !== args.mimeType ||
        existing.expiresAt <= Date.now() ||
        existing.status === "failed"
      )
        throw new ConvexError(
          "Upload unavailable. Request a replacement for the failed item.",
        );
      const asset = await ctx.db.get(existing.assetId);
      if (
        !asset ||
        asset._id !== item.videoAssetId ||
        (asset.status !== "processing" && asset.status !== "ready")
      )
        throw new ConvexError("Upload unavailable.");
      if (!existing.providerUploadUrl)
        throw new ConvexError(
          "Upload preparation is pending. Retry the same request shortly.",
        );
      return {
        id: existing._id,
        assetId: asset._id,
        reservationId: asset.reservationId,
        organizationId: job.organizationId,
        create: false,
        capability: asCapability(existing),
      };
    }
    if (args.grant) await requirePaidAssistant(ctx, args.grant);
    const entitlement = await getOrganizationBillingEntitlement(
      ctx,
      job.organizationId,
    );
    if (
      entitlement.effectivePlan !== "premium" ||
      entitlement.state === "past_due"
    )
      throw new ConvexError("Pro is required to request a new video upload.");
    if (item.videoStatus !== "failed")
      throw new ConvexError(
        "Only a missing or failed video can receive a file.",
      );
    await retryOwnedImportVideo(ctx, item._id, principal, job._id, true);
    const current = (await ctx.db.get(item._id))!;
    const asset = (await ctx.db.get(current.videoAssetId!))!;
    const token =
      crypto.randomUUID().replaceAll("-", "") +
      crypto.randomUUID().replaceAll("-", "");
    const expiresAt = Math.min(
      Date.now() + 15 * 60_000,
      args.grant?.expiresAt ?? Infinity,
    );
    const id = await ctx.db.insert("assistantImportUploads", {
      actorId: principal.actorId,
      jobId: job._id,
      itemId: item._id,
      assetId: asset._id,
      requestId: args.requestId,
      token,
      tokenHash: await hashSubmissionManagementToken(token),
      expiresAt,
      grant: args.grant,
      totalBytes: args.totalBytes,
      mimeType: args.mimeType,
      offset: 0,
      status: "preparing",
      creationStartedAt: Date.now(),
    });
    await ctx.scheduler.runAt(expiresAt, internal.assistantUploads.expire, {
      id,
    });
    return {
      id,
      assetId: asset._id,
      reservationId: asset.reservationId,
      organizationId: job.organizationId,
      create: true,
      capability: asCapability((await ctx.db.get(id))!),
    };
  },
});

export const attach = internalMutation({
  args: { id: v.id("assistantImportUploads"), providerUploadUrl: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const upload = await ctx.db.get(args.id);
    if (
      !upload ||
      upload.status !== "preparing" ||
      upload.expiresAt <= Date.now()
    )
      throw new ConvexError("Upload expired.");
    await ctx.db.patch(upload._id, {
      providerUploadUrl: args.providerUploadUrl,
      status: "uploading",
    });
    return null;
  },
});

async function issue(
  ctx: ActionCtx,
  args: {
    jobId: Doc<"testimonialImportJobs">["_id"];
    itemId: Doc<"testimonialImportItems">["_id"];
    requestId: string;
    totalBytes: number;
    mimeType: string;
    grant?: import("./domain/importAccessToken").ImportAccessGrant;
  },
): Promise<Infer<typeof capability>> {
  const prepared = await ctx.runMutation(
    internal.assistantUploads.prepare,
    args,
  );
  if (prepared.create) {
    try {
      const upload = await createVideoDirectUpload({
        corsOrigin: "*",
        passthrough: prepared.reservationId,
        organizationId: prepared.organizationId,
        spokenLanguage: "en",
      });
      await ctx.runMutation(
        internal.testimonialImportVideo.attachAssistantUpload,
        { assetId: prepared.assetId, providerUploadId: upload.uploadId },
      );
      await ctx.runMutation(internal.assistantUploads.attach, {
        id: prepared.id,
        providerUploadUrl: upload.uploadUrl,
      });
    } catch (error) {
      await ctx.runMutation(internal.testimonialImportVideo.rejectCopy, {
        assetId: prepared.assetId,
        reason: "Upload preparation failed. Request a replacement file upload.",
      });
      throw error;
    }
  }
  return prepared.capability;
}
export const issueForAssistant = internalAction({
  args: { ...uploadArgs, grant: importGrant },
  returns: capability,
  handler: issue,
});
export const issueFromInbox = action({
  args: uploadArgs,
  returns: capability,
  handler: issue,
});

async function authorizeUpload(ctx: MutationCtx, token: string) {
  if (!/^[a-f0-9]{64}$/.test(token))
    throw new ConvexError("Upload unavailable.");
  // The actual token lookup is isolated from any caller-supplied document ID.
  const tokenHash = await hashSubmissionManagementToken(token);
  const current = await ctx.db
    .query("assistantImportUploads")
    .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
    .unique();
  if (
    !current ||
    current.expiresAt <= Date.now() ||
    !["uploading", "finalizing", "complete"].includes(current.status) ||
    !current.providerUploadUrl
  )
    throw new ConvexError("Upload unavailable or expired.");
  let principal: Principal;
  if (current.grant)
    principal = await requireImportPrincipal(ctx, current.grant);
  else {
    const user = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "user",
      where: [{ field: "_id", value: current.actorId }],
    });
    if (!user?.emailVerified) throw new ConvexError("Upload unavailable.");
    principal = {
      actorId: current.actorId,
      email: user.email,
      emailVerified: user.emailVerified,
      name: user.name,
    };
  }
  const job = await ctx.db.get(current.jobId);
  const asset = await ctx.db.get(current.assetId);
  const item = await ctx.db.get(current.itemId);
  if (
    !job ||
    !asset ||
    !item ||
    item.videoAssetId !== asset._id ||
    (asset.status !== "processing" && asset.status !== "ready") ||
    job.createdBy !== principal.actorId
  )
    throw new ConvexError("Upload unavailable.");
  await requireOrganizationPermissionForPrincipal(
    ctx,
    { organizationId: job.organizationId },
    "ownership:manage",
    principal,
  );
  return current;
}

const partArgs = {
  token: v.string(),
  offset: v.number(),
  length: v.number(),
  digest: v.string(),
  final: v.boolean(),
};
export const claimPart = internalMutation({
  args: partArgs,
  returns: v.object({
    uploadUrl: v.string(),
    replay: v.boolean(),
    finalizing: v.boolean(),
    nextOffset: v.number(),
    assetId: v.id("videoAssets"),
    mimeType: v.string(),
    totalBytes: v.number(),
  }),
  handler: async (ctx, args) => {
    const upload = await authorizeUpload(ctx, args.token);
    if (
      !Number.isSafeInteger(args.offset) ||
      !Number.isSafeInteger(args.length) ||
      args.length <= 0 ||
      args.length > chunkSize ||
      args.offset < 0 ||
      args.offset + args.length > upload.totalBytes ||
      args.final !== (args.offset + args.length === upload.totalBytes)
    )
      throw new ConvexError("Invalid upload range.");
    const replay =
      upload.previous?.offset === args.offset &&
      upload.previous.digest === args.digest &&
      upload.previous.length === args.length;
    if (!replay) {
      if (upload.status === "complete")
        throw new ConvexError("Upload already complete.");
      if (
        upload.offset !== args.offset ||
        (upload.pending &&
          (upload.pending.offset !== args.offset ||
            upload.pending.digest !== args.digest ||
            upload.pending.length !== args.length ||
            upload.pending.final !== args.final))
      )
        throw new ConvexError(
          "Resume at the recorded offset with the same bytes.",
        );
      await ctx.db.patch(upload._id, {
        pending: {
          offset: args.offset,
          length: args.length,
          digest: args.digest,
          final: args.final,
        },
      });
    }
    return {
      uploadUrl: upload.providerUploadUrl!,
      replay,
      finalizing: upload.status === "finalizing",
      nextOffset: upload.offset,
      assetId: upload.assetId,
      mimeType: upload.mimeType,
      totalBytes: upload.totalBytes,
    };
  },
});
// Claim the final provider write once. An interrupted response is ambiguous:
// retain the reservation for the provider webhook instead of sending it again.
export const beginFinalization = internalMutation({
  args: partArgs,
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const upload = await authorizeUpload(ctx, args.token);
    if (
      !args.final ||
      !upload.pending ||
      upload.pending.offset !== args.offset ||
      upload.pending.length !== args.length ||
      upload.pending.digest !== args.digest ||
      !upload.pending.final
    )
      throw new ConvexError("Final upload range unavailable.");
    if (upload.status === "finalizing") return false;
    if (upload.status !== "uploading")
      throw new ConvexError("Upload unavailable.");
    await ctx.db.patch(upload._id, { status: "finalizing" });
    return true;
  },
});

export const finishPart = internalMutation({
  args: partArgs,
  returns: v.number(),
  handler: async (ctx, args) => {
    const tokenHash = await hashSubmissionManagementToken(args.token);
    const upload = await ctx.db
      .query("assistantImportUploads")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
      .unique();
    if (
      !upload ||
      !["uploading", "finalizing", "complete"].includes(upload.status)
    )
      throw new ConvexError("Upload unavailable.");
    if (
      upload.previous?.offset === args.offset &&
      upload.previous.digest === args.digest
    )
      return upload.offset;
    if (
      !upload.pending ||
      upload.pending.offset !== args.offset ||
      upload.pending.digest !== args.digest ||
      upload.pending.length !== args.length ||
      upload.pending.final !== args.final
    )
      throw new ConvexError("Upload range unavailable.");
    const offset = args.offset + args.length;
    await ctx.db.patch(upload._id, {
      offset,
      pending: undefined,
      previous: {
        offset: args.offset,
        length: args.length,
        digest: args.digest,
      },
      status: args.final ? "complete" : "uploading",
    });
    return offset;
  },
});
export const rejectFinalization = internalMutation({
  args: { token: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const upload = await authorizeUpload(ctx, args.token);
    if (upload.status !== "finalizing") return null;
    await ctx.db.patch(upload._id, {
      status: "failed",
      token: "",
      grant: undefined,
      providerUploadUrl: undefined,
    });
    await failCopyRecord(
      ctx,
      upload.assetId,
      "The video provider rejected this file. Choose a replacement file from the Inbox.",
    );
    return null;
  },
});

export const expire = internalMutation({
  args: { id: v.id("assistantImportUploads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const upload = await ctx.db.get(args.id);
    if (!upload || upload.expiresAt > Date.now() || upload.status === "failed")
      return null;
    if (upload.status === "complete" || upload.status === "finalizing") {
      await ctx.db.patch(upload._id, {
        token: "",
        grant: undefined,
        providerUploadUrl: undefined,
      });
      return null;
    }
    await ctx.db.patch(upload._id, {
      status: "failed",
      token: "",
      grant: undefined,
      providerUploadUrl: undefined,
    });
    await failCopyRecord(
      ctx,
      upload.assetId,
      "The file upload expired. Choose the file again to resume this Pending testimonial.",
    );
    return null;
  },
});

export const receivePart = httpAction(async (ctx, request) => {
  const headers = {
    "Access-Control-Allow-Origin": env.SITE_URL ?? "",
    "Access-Control-Allow-Headers":
      "Authorization, Content-Type, Content-Range",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
  if (request.method === "OPTIONS") return new Response(null, { headers });
  const token =
    request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const range = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(
    request.headers.get("content-range") ?? "",
  );
  if (!range || !/^[a-f0-9]{64}$/.test(token))
    return new Response(null, { status: 400, headers });
  const offset = Number(range[1]);
  const end = Number(range[2]);
  const total = Number(range[3]);
  if (total > maximumBytes || end - offset + 1 > chunkSize)
    return new Response(null, { status: 413, headers });
  try {
    const reader = request.body?.getReader();
    if (!reader) return new Response(null, { status: 400, headers });
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > chunkSize) {
        await reader.cancel();
        return new Response(null, { status: 413, headers });
      }
      chunks.push(next.value);
    }
    if (length !== end - offset + 1)
      return new Response(null, { status: 400, headers });
    const bytes = new Uint8Array(length);
    let cursor = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, cursor);
      cursor += chunk.byteLength;
    }
    const digest = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      (byte) => byte.toString(16).padStart(2, "0"),
    ).join("");
    const args = { token, offset, length, digest, final: end + 1 === total };
    const part = await ctx.runMutation(
      internal.assistantUploads.claimPart,
      args,
    );
    if (part.totalBytes !== total)
      return new Response(null, { status: 400, headers });
    if (part.replay)
      return Response.json(
        { offset: part.nextOffset, complete: part.nextOffset === total },
        { headers },
      );
    if (part.finalizing)
      return Response.json(
        { offset: part.nextOffset, status: "finalizing" },
        { status: 202, headers },
      );
    if (args.final)
      await ctx.runMutation(
        internal.testimonialImportVideo.verifyAssistantFile,
        {
          assetId: part.assetId,
          fileSizeBytes: total,
          mimeType: part.mimeType,
        },
      );
    if (
      args.final &&
      !(await ctx.runMutation(
        internal.assistantUploads.beginFinalization,
        args,
      ))
    )
      return Response.json(
        { offset, status: "finalizing" },
        { status: 202, headers },
      );
    let response: Response;
    try {
      response = await fetch(part.uploadUrl, {
        method: "PUT",
        redirect: "manual",
        signal: AbortSignal.timeout(30_000),
        headers: {
          "Content-Type": part.mimeType,
          "Content-Length": String(length),
          "Content-Range": `bytes ${offset}-${end}/${args.final ? total : "*"}`,
        },
        body: bytes,
      });
    } catch (error) {
      if (args.final)
        return Response.json(
          { offset, status: "finalizing" },
          { status: 202, headers },
        );
      throw error;
    }
    if (
      args.final &&
      response.status >= 400 &&
      response.status < 500 &&
      response.status !== 408 &&
      response.status !== 429
    ) {
      await ctx.runMutation(internal.assistantUploads.rejectFinalization, {
        token,
      });
      return Response.json(
        {
          error:
            "The video provider rejected this file. Choose a replacement file from the Inbox.",
        },
        { status: 422, headers },
      );
    }
    if (args.final && !response.ok)
      return Response.json(
        { offset, status: "finalizing" },
        { status: 202, headers },
      );
    if (!(args.final ? response.ok : response.status === 308))
      return new Response(null, { status: 502, headers });
    const nextOffset = await ctx.runMutation(
      internal.assistantUploads.finishPart,
      args,
    );
    return Response.json(
      { offset: nextOffset, complete: args.final },
      { headers },
    );
  } catch {
    return new Response(null, { status: 409, headers });
  }
});
