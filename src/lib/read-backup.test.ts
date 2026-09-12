// @vitest-environment node
import { expect, it } from "vitest";
import { ZipWriter, BlobWriter, TextReader } from "@zip.js/zip.js";
import { backupSlug, nameBackupMedia } from "./backup-filenames";
import { readBackup, backupMediaBlob } from "./read-backup";
it("names media after people, handling accents and duplicate names", () => {
  const data = {
    organization: { _id: "org", publicSlug: "studio" },
    testimonials: [
      { _id: "a", submitterName: "Élodie Roche" },
      { _id: "b", submitterName: "Élodie Roche" },
    ],
    media: [
      { ownerId: "a", path: "images/a/avatar.webp", kind: "image" },
      { ownerId: "b", path: "videos/b.mp4", kind: "video" },
    ],
  };
  nameBackupMedia(data);
  expect(data.media.map((m) => m.path)).toEqual([
    "images/elodie-roche/avatar.webp",
    "videos/elodie-roche-2.mp4",
  ]);
  expect(backupSlug("CON", "person")).toBe("person");
});
async function zip(missing = false) {
  const writer = new ZipWriter(new BlobWriter(), { useWebWorkers: false });
  await writer.add(
    "data.json",
    new TextReader(
      JSON.stringify({
        schemaVersion: 2,
        organization: { _id: "org" },
        testimonials: [
          {
            _id: "t",
            submitterName: "Maya Chen",
            text: "Great",
            submissionType: "text",
          },
        ],
        media: [
          {
            ownerId: "t",
            path: "images/maya/avatar.png",
            role: "avatar",
            status: "included",
          },
        ],
      }),
    ),
  );
  if (!missing)
    await writer.add("images/maya/avatar.png", new TextReader("IMAGE"));
  return writer.close();
}
it("reads portable media from the ZIP itself and detects missing assets", async () => {
  const backup = await readBackup(await zip());
  expect(backup.items[0].candidate.authorName).toBe("Maya Chen");
  expect(backup.items[0].missing).toBe(0);
  expect(await (await backupMediaBlob(backup.items[0].media[0])).text()).toBe(
    "IMAGE",
  );
  await backup.close();
  const incomplete = await readBackup(await zip(true));
  expect(incomplete.items[0].missing).toBe(1);
  await incomplete.close();
});
