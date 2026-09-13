import type { ReactNode } from "react";

/** Provider IDs and pagination tokens are opaque to the shared browser. */
export type ReviewSelection = readonly string[];
export type ReviewRead = {
  selection: ReviewSelection;
  cursor?: string;
};
export type ConnectedReview = {
  id: string;
  author: string;
  body?: string;
  stars?: number;
  updatedAt?: string;
};
export type ReviewUpdate = {
  selection: ReviewSelection;
  revision: number;
};
export type ConnectorPanel = {
  id: string;
  label: string;
  content: ReactNode;
};
