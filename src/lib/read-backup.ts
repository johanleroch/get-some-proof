import { BlobReader, BlobWriter, TextWriter, ZipReader, type FileEntry } from "@zip.js/zip.js";
import { z } from "zod";
import type { Infer } from "convex/values";
import type { wallCandidate } from "@convex/domain/testimonialImport";
import { normalizeRichText } from "@convex/domain/testimonialRichText";
const testimonial = z.object({ _id: z.string().min(1).max(128), submitterName: z.string().min(1).max(160), text: z.string().max(20000), submissionType: z.enum(["text", "video"]), role: z.string().max(240).optional(), company: z.string().max(240).optional(), rating: z.number().int().min(1).max(5).optional(), richText: z.unknown().optional() });
const manifest = z.object({ schemaVersion: z.literal(2), organization: z.object({ _id: z.string().min(1).max(128) }), testimonials: z.array(testimonial).max(10000), media: z.array(z.object({ ownerId: z.string(), path: z.string().max(256), status: z.enum(["included", "missing"]), role: z.string().optional() })).max(50000) });
export type BackupItem = { candidate: Infer<typeof wallCandidate>; media: Array<{ path: string; role: "avatar" | "thumbnail" | "image" | "video"; entry: FileEntry }>; missing: number };
export type BackupFile = { sourceProject: string; items: BackupItem[]; close: () => Promise<void> };
function safePath(path: string) { return !path.startsWith("/") && !path.includes("\\") && !path.split("/").includes("..") && !path.includes("\0"); }
export async function readBackup(file: Blob): Promise<BackupFile> {
  const reader = new ZipReader(new BlobReader(file), { useWebWorkers: false });
  try {
    const entries = new Map<string, FileEntry>(); let size = 0;
    for await (const entry of reader.getEntriesGenerator()) {
      if (entry.directory) continue;
      size += entry.uncompressedSize;
      if (!safePath(entry.filename) || entries.has(entry.filename) || entry.encrypted || entries.size >= 50002 || size > 10 * 1024 ** 3 || entry.uncompressedSize > 512 * 1024 ** 2) throw new Error("This backup contains unsupported or oversized files.");
      entries.set(entry.filename, entry);
    }
    const json = entries.get("data.json");
    if (!json || json.uncompressedSize > 10 * 1024 ** 2) throw new Error("Choose a Get Some Proof ZIP backup containing data.json.");
    const data = manifest.parse(JSON.parse(await json.getData(new TextWriter(), { checkSignature: true })));
    const ids = new Set<string>();
    const items = data.testimonials.map(t => {
      if (ids.has(t._id)) throw new Error("Duplicate testimonial IDs in backup."); ids.add(t._id);
      const media: BackupItem["media"] = []; let missing = 0;
      for (const asset of data.media.filter(asset => asset.ownerId === t._id)) {
        if (!safePath(asset.path)) throw new Error("Invalid media path in backup.");
        const entry = entries.get(asset.path);
        if (asset.status !== "included" || !entry) { missing++; continue; }
        const role = asset.role ?? (asset.path.startsWith("videos/") ? "video" : /\/avatar\./.test(asset.path) ? "avatar" : /\/thumbnail\./.test(asset.path) ? "thumbnail" : "image");
        if (!["avatar", "thumbnail", "image", "video"].includes(role)) continue;
        media.push({ path: asset.path, role: role as BackupItem["media"][number]["role"], entry });
      }
      if (t.submissionType === "video" && !media.some(m => m.role === "video")) missing++;
      return { candidate: { sourceId: t._id, authorName: t.submitterName, text: t.text, type: t.submissionType, ...(t.role ? { tagline: t.role } : {}), ...(t.company ? { company: t.company } : {}), ...(t.rating ? { rating: t.rating } : {}), ...(t.richText ? { richText: normalizeRichText(t.richText as Parameters<typeof normalizeRichText>[0], t.text) } : {}) }, media, missing };
    });
    return { sourceProject: data.organization._id, items, close: () => reader.close() };
  } catch (error) { await reader.close(); throw error; }
}
export async function backupMediaBlob(media: BackupItem["media"][number]) {
  const extension = media.path.split(".").at(-1)?.toLowerCase() ?? "";
  const type = ({ webp: "image/webp", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", avif: "image/avif", mp4: "video/mp4" } as Record<string, string>)[extension];
  if (!type) throw new Error(`Unsupported backup media: ${media.path}`);
  return media.entry.getData(new BlobWriter(type), { checkSignature: true });
}
