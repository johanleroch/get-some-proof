"use client";

import { type FormEvent, useState } from "react";
import { Archive, Pencil, Plus, Trash2, X } from "lucide-react";
import { useMutation, useQuery } from "convex/react";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Project = {
  id: Id<"projects">;
  name: string;
  description: string;
  status: "active" | "archived";
};

type EditorState = { mode: "create" } | { mode: "edit"; project: Project };

function errorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "The Project action could not be completed.";
  }

  return error.message.includes("ORGANIZATION_ACCESS_DENIED")
    ? "Your role does not allow this Project action."
    : error.message;
}

export function ProjectManager({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const projects = useQuery(api.projects.list, { organizationId });
  const access = useQuery(api.organizationAuthorization.getMine, {
    organizationId,
  });
  const createProject = useMutation(api.projects.create);
  const updateProject = useMutation(api.projects.update);
  const archiveProject = useMutation(api.projects.archive);
  const removeProject = useMutation(api.projects.remove);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (projects === undefined || access === undefined) {
    return <p className="text-muted-foreground text-sm">Loading Projects…</p>;
  }

  const canWrite = access.can.createProjects;
  const canDelete = access.can.deleteProjects;

  async function submitProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    setPending(true);
    setError(null);
    setSuccess(null);
    const form = new FormData(event.currentTarget);
    const input = {
      organizationId,
      name: String(form.get("name")),
      description: String(form.get("description")),
    };

    try {
      if (editor.mode === "create") {
        await createProject(input);
        setSuccess("Project created.");
      } else {
        await updateProject({ ...input, projectId: editor.project.id });
        setSuccess("Project updated.");
      }
      setEditor(null);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  async function archive(project: Project) {
    setError(null);
    setSuccess(null);
    try {
      await archiveProject({ organizationId, projectId: project.id });
      setSuccess(`${project.name} archived.`);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      await removeProject({
        organizationId,
        projectId: deleteTarget.id,
      });
      setSuccess(`${deleteTarget.name} permanently deleted.`);
      setDeleteTarget(null);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            A removable, Tenant-scoped module demonstrating the complete role
            matrix.
          </p>
        </div>
        {canWrite ? (
          <Button onClick={() => setEditor({ mode: "create" })}>
            <Plus aria-hidden="true" className="size-4" />
            New Project
          </Button>
        ) : null}
      </div>

      {error ? (
        <p
          aria-live="assertive"
          className="mt-6 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          {error}
        </p>
      ) : null}
      {success ? (
        <p
          aria-live="polite"
          className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
        >
          {success}
        </p>
      ) : null}

      {projects.length === 0 ? (
        <section className="bg-card mt-6 rounded-xl border border-dashed p-10 text-center shadow-xs">
          <h2 className="font-semibold">No Projects yet</h2>
          <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm">
            {canWrite
              ? "Create the first Project to see Tenant-scoped CRUD in action."
              : "A Member with editing permission can create the first Project."}
          </p>
        </section>
      ) : (
        <div className="bg-card mt-6 overflow-hidden rounded-xl border shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-muted-foreground border-b text-xs">
                <tr>
                  <th className="px-5 py-3 font-medium" scope="col">
                    Name
                  </th>
                  <th className="px-5 py-3 font-medium" scope="col">
                    Status
                  </th>
                  <th className="px-5 py-3 font-medium" scope="col">
                    Description
                  </th>
                  <th className="px-5 py-3 text-right font-medium" scope="col">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {projects.map((project) => (
                  <tr key={project.id}>
                    <th className="px-5 py-4 font-medium" scope="row">
                      {project.name}
                    </th>
                    <td className="px-5 py-4">
                      <span className="bg-muted rounded-full px-2.5 py-1 text-xs capitalize">
                        {project.status}
                      </span>
                    </td>
                    <td className="text-muted-foreground max-w-md px-5 py-4">
                      {project.description || "No description"}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-1">
                        {canWrite ? (
                          <>
                            <Button
                              aria-label={`Edit ${project.name}`}
                              onClick={() =>
                                setEditor({ mode: "edit", project })
                              }
                              size="icon"
                              variant="ghost"
                            >
                              <Pencil aria-hidden="true" className="size-4" />
                            </Button>
                            {project.status === "active" ? (
                              <Button
                                aria-label={`Archive ${project.name}`}
                                onClick={() => void archive(project)}
                                size="icon"
                                variant="ghost"
                              >
                                <Archive
                                  aria-hidden="true"
                                  className="size-4"
                                />
                              </Button>
                            ) : null}
                          </>
                        ) : null}
                        {canDelete ? (
                          <Button
                            aria-label={`Delete ${project.name}`}
                            onClick={() => setDeleteTarget(project)}
                            size="icon"
                            variant="ghost"
                          >
                            <Trash2
                              aria-hidden="true"
                              className="size-4 text-red-600"
                            />
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editor ? (
        <div
          aria-labelledby="project-editor-title"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          role="dialog"
        >
          <div className="bg-background w-full max-w-lg rounded-xl border p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold" id="project-editor-title">
                  {editor.mode === "create" ? "Create Project" : "Edit Project"}
                </h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  This record will remain scoped to the active Organization.
                </p>
              </div>
              <Button
                aria-label="Close Project editor"
                onClick={() => setEditor(null)}
                size="icon"
                variant="ghost"
              >
                <X aria-hidden="true" className="size-4" />
              </Button>
            </div>
            <form className="mt-6 space-y-5" onSubmit={submitProject}>
              <div className="space-y-2">
                <Label htmlFor="project-name">Name</Label>
                <Input
                  autoFocus
                  defaultValue={
                    editor.mode === "edit" ? editor.project.name : ""
                  }
                  id="project-name"
                  maxLength={100}
                  minLength={2}
                  name="name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-description">Description</Label>
                <textarea
                  className="border-input focus-visible:ring-ring min-h-28 w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2"
                  defaultValue={
                    editor.mode === "edit" ? editor.project.description : ""
                  }
                  id="project-description"
                  maxLength={1000}
                  name="description"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => setEditor(null)}
                  type="button"
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button disabled={pending} type="submit">
                  {pending ? "Saving…" : "Save Project"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div
          aria-describedby="delete-project-description"
          aria-labelledby="delete-project-title"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          role="alertdialog"
        >
          <div className="bg-background w-full max-w-md rounded-xl border p-6 shadow-xl">
            <h2 className="text-xl font-semibold" id="delete-project-title">
              Permanently delete Project?
            </h2>
            <p
              className="text-muted-foreground mt-2 text-sm leading-6"
              id="delete-project-description"
            >
              {deleteTarget.name} will be removed immediately. This action
              cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button onClick={() => setDeleteTarget(null)} variant="outline">
                Cancel
              </Button>
              <Button
                disabled={pending}
                onClick={() => void confirmDelete()}
                variant="destructive"
              >
                {pending ? "Deleting…" : "Delete permanently"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
