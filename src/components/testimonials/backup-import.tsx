"use client";
import { useEffect, useRef, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { blobToast } from "@/components/brand/blob-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  readBackup,
  backupMediaBlob,
  type BackupFile,
} from "@/lib/read-backup";
import { uploadProfileImage } from "@/lib/upload-profile-image";
import { transferAssistantVideo } from "@/lib/assistant-video-transfer";
import { convexErrorMessage } from "@/lib/convex-error-message";

export function BackupImport({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const restore = useMutation(api.backupImports.restore);
  const imageUpload = useMutation(api.backupImports.imageUpload);
  const attach = useMutation(api.backupImports.attachImage);
  const processImage = useAction(api.imageAssetProcessing.processDirectUpload);
  const issueVideo = useAction(api.assistantUploads.issueFromInbox);
  const backup = useRef<BackupFile | null>(null);
  const [preview, setPreview] = useState<BackupFile | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const abort = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      abort.current?.abort();
      void backup.current?.close();
    },
    [],
  );
  async function choose(file?: File) {
    if (!file) return;
    setBusy(true);
    setTotal(0);
    setDone(0);
    setStatus("Reading backup…");
    setPreview(null);
    try {
      await backup.current?.close();
      const value = await readBackup(file);
      backup.current = value;
      setPreview(value);
      setSelected(
        new Set(
          value.items
            .filter((item) => !item.missing && !item.unavailableReason)
            .map((item) => item.candidate.sourceId),
        ),
      );
      setStatus("");
    } catch {
      blobToast.error(
        "This backup could not be read. Choose a Get Some Proof ZIP with data.json and its media files.",
      );
      setStatus("");
    } finally {
      setBusy(false);
    }
  }
  async function importSelected() {
    if (!preview) return;
    const items = preview.items.filter((item) =>
      selected.has(item.candidate.sourceId),
    );
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setDone(0);
    setTotal(items.length);
    let imported = 0;
    let skipped = 0;
    try {
      // Small batches bound Convex mutation payloads and preserve completed work on retry.
      for (let offset = 0; offset < items.length; offset += 10) {
        controller.signal.throwIfAborted();
        const batch = items.slice(offset, offset + 10);
        const result = await restore({
          organizationId,
          sourceProject: preview.sourceProject,
          items: batch.map((item) => item.candidate),
        });
        for (const record of result.items) {
          const original = batch.find(
            (item) => item.candidate.sourceId === record.sourceId,
          )!;
          if (record.skipped) {
            skipped++;
            setDone((value) => value + 1);
            continue;
          }
          if (!record.testimonialId)
            throw new Error("A testimonial could not be restored.");
          for (const [mediaIndex, media] of original.media.entries()) {
            controller.signal.throwIfAborted();
            setStatus(`${original.candidate.authorName} · ${media.role}`);
            if (media.role === "video") {
              if (!record.videoNeeded) continue;
              const blob = await backupMediaBlob(media);
              const capability = await issueVideo({
                jobId: record.uploadJobId,
                itemId: record.itemId,
                requestId: record.videoRequestId ?? crypto.randomUUID(),
                totalBytes: blob.size,
                mimeType: "video/mp4",
              });
              await transferAssistantVideo(blob, capability, {
                signal: controller.signal,
                onProgress: (bytes, size) =>
                  setStatus(
                    `${original.candidate.authorName} · video ${Math.floor((bytes / size) * 100)}%`,
                  ),
              });
            } else {
              const upload = await imageUpload({
                testimonialId: record.testimonialId,
                role: media.role,
                sourcePath: `${record.sourceId}/${media.role}-${mediaIndex}`,
              });
              if (!upload) continue;
              const blob = await backupMediaBlob(media);
              const image = await uploadProfileImage(
                blob,
                upload.uploadUrl,
                upload.target.kind,
                processImage,
                upload.target,
              );
              await attach({
                testimonialId: record.testimonialId,
                target: upload.target,
                verificationId: image.verificationId,
              });
            }
          }
          imported++;
          setDone((value) => value + 1);
        }
      }
      blobToast.success(
        `${imported} testimonials restored to the Inbox. ${skipped} duplicates skipped. Videos may still be processing.`,
      );
    } catch (cause) {
      if (!controller.signal.aborted)
        blobToast.error(
          convexErrorMessage(
            cause,
            "Import interrupted. Completed testimonials remain in your Inbox.",
          ),
        );
    } finally {
      setBusy(false);
      abort.current = null;
      setStatus("");
    }
  }
  return (
    <section className="space-y-5" aria-label="Get Some Proof backup">
      <div className="space-y-2">
        <Label htmlFor="backup-file">Get Some Proof ZIP</Label>
        <Input
          id="backup-file"
          type="file"
          accept=".zip,application/zip"
          disabled={busy}
          onChange={(event) => {
            void choose(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <p className="text-ink-2 text-sm">
          Restore testimonials and their media into this project’s Inbox.
          Existing testimonials are kept. Video imports require Pro (512 MB per
          file). Nothing is published automatically.
        </p>
      </div>
      {preview ? (
        <>
          <p className="text-sm">
            {preview.items.length} testimonials found · {selected.size} selected
          </p>
          <ul className="border-line max-h-80 divide-y overflow-y-auto rounded-lg border">
            {preview.items.map((item) => (
              <li key={item.candidate.sourceId} className="px-4 py-3">
                <label className="flex items-start gap-3">
                  <Checkbox
                    disabled={
                      busy || item.missing > 0 || !!item.unavailableReason
                    }
                    checked={selected.has(item.candidate.sourceId)}
                    onCheckedChange={(checked) =>
                      setSelected((previous) => {
                        const next = new Set(previous);
                        if (checked) next.add(item.candidate.sourceId);
                        else next.delete(item.candidate.sourceId);
                        return next;
                      })
                    }
                  />
                  <span className="min-w-0 text-sm">
                    <span className="block font-medium">
                      {item.candidate.authorName}
                    </span>
                    <span className="text-ink-2">
                      {item.candidate.type === "video" ? "Video" : "Text"} ·{" "}
                      {item.media.length} files
                      {item.unavailableReason
                        ? ` · ${item.unavailableReason}`
                        : item.missing
                          ? ` · ${item.missing} missing files: export again to restore this testimonial`
                          : ""}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <Button
            loading={busy}
            disabled={!selected.size}
            onClick={() => void importSelected()}
          >
            Import selected testimonials
          </Button>
        </>
      ) : null}
      {busy && total > 0 ? (
        <div
          role="progressbar"
          aria-label="Testimonials restored"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
          className="bg-surface-2 h-2 overflow-hidden rounded-full"
        >
          <div
            className="bg-brand h-full"
            style={{ width: `${(done / total) * 100}%` }}
          />
        </div>
      ) : null}
      {busy && status ? (
        <p role="status" className="text-ink-2 text-sm">
          {status}
        </p>
      ) : null}
    </section>
  );
}
