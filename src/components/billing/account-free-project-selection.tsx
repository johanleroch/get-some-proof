"use client";

import { useState } from "react";
import { useMutation, useQuery, usePaginatedQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ErrorToast, SuccessToast } from "@/components/ui/error-toast";

export function AccountFreeProjectSelection() {
  const account = useQuery(api.accounts.getMine, {});
  const {
    results: projects,
    status,
    loadMore,
  } = usePaginatedQuery(
    api.organizations.listMinePage,
    {},
    { initialNumItems: 50 },
  );
  const selectProject = useMutation(api.accounts.selectFreeProject);
  if (!account || account.effectivePlan !== "premium" || !projects.length)
    return null;
  return (
    <AccountFreeProjectSelectionView
      projects={projects}
      freeProjectId={account.freeProjectId}
      freeProjectName={account.freeProjectName}
      status={status}
      loadMore={() => loadMore(50)}
      selectProject={(projectId) => selectProject({ projectId })}
    />
  );
}

export function AccountFreeProjectSelectionView({
  projects,
  freeProjectId,
  freeProjectName,
  status,
  loadMore,
  selectProject,
}: {
  projects: Array<{ id: Id<"organizations">; name: string }>;
  freeProjectId: Id<"organizations"> | null;
  freeProjectName: string | null;
  status: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";
  loadMore: () => void;
  selectProject: (projectId: Id<"organizations">) => Promise<unknown>;
}) {
  const [selected, setSelected] = useState<Id<"organizations"> | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const projectId = selected ?? freeProjectId ?? projects[0].id;
  return (
    <form
      className="space-y-3 border-t pt-6"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError(null);
        setSaved(false);
        try {
          await selectProject(projectId);
          setSaved(true);
        } catch (caught) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Could not save your project choice.",
          );
        } finally {
          setPending(false);
        }
      }}
    >
      <Label htmlFor="free-project">Your project on Free</Label>
      <p className="text-ink-2 text-sm">
        If your Pro plan ends, only this project stays active. Without a choice,
        your oldest project stays active.
      </p>
      <Select
        value={projectId}
        disabled={pending}
        onValueChange={(value) => {
          setSelected(value as Id<"organizations">);
          setSaved(false);
        }}
      >
        <SelectTrigger id="free-project" className="w-full">
          <SelectValue>
            {projects.find((project) => project.id === projectId)?.name ??
              freeProjectName}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {projects.map((project) => (
            <SelectItem key={project.id} value={project.id}>
              {project.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-ink-2 text-sm">
        Other projects remain available privately, but their collection and
        public pages stop. Excess videos are permanently deleted after 30 days,
        with advance warnings.
      </p>
      {status === "CanLoadMore" || status === "LoadingMore" ? (
        <Button
          type="button"
          variant="ghost"
          loading={status === "LoadingMore"}
          onClick={loadMore}
        >
          Load more projects
        </Button>
      ) : null}
      <Button type="submit" loading={pending} variant="outline">
        Save project choice
      </Button>
      {error ? <ErrorToast message={error} /> : null}
      {saved ? <SuccessToast message="Free project saved." /> : null}
    </form>
  );
}
