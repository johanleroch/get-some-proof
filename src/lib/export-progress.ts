export type ExportProgress = {
  phase: "preparing" | "media" | "finalizing" | "saving" | "done";
  processed: number;
  total: number;
  failed: number;
  current?: string;
};
export type ExportStreamEvent =
  | { type: "progress"; progress: ExportProgress }
  | { type: "archive"; complete: boolean }
  | { type: "error"; message: string };
