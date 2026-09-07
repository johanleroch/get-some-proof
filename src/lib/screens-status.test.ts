import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  parseScreenStatuses,
  readScreenStatuses,
  writeScreenStatus,
} from "@/lib/screens-status";

describe("screen review statuses", () => {
  it("keeps only known screens with valid statuses", () => {
    expect(
      parseScreenStatuses(
        JSON.stringify({
          dashboard: "ok",
          inbox: "todo",
          unknown: "ok",
          "sign-in": "later",
        }),
      ),
    ).toEqual({ dashboard: "ok", inbox: "todo" });
    expect(parseScreenStatuses("not json")).toEqual({});
    expect(parseScreenStatuses("[]")).toEqual({});
  });

  it("writes sorted statuses and removes cleared ones", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "screens-status-"));
    const filePath = path.join(directory, "screens-status.json");

    expect(await readScreenStatuses(filePath)).toEqual({});
    await writeScreenStatus("inbox", "todo", filePath);
    await writeScreenStatus("dashboard", "ok", filePath);
    expect(await readFile(filePath, "utf8")).toBe(
      '{\n  "dashboard": "ok",\n  "inbox": "todo"\n}\n',
    );

    await writeScreenStatus("inbox", null, filePath);
    expect(await readScreenStatuses(filePath)).toEqual({ dashboard: "ok" });
  });
});
