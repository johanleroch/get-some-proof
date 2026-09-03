"use client";

import { type FormEvent, useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Archive, Pencil, Plus, Trash2, X } from "lucide-react";
import { useMutation, useQuery } from "convex/react";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProjectsPageSkeleton } from "@/components/ui/page-skeletons";

type Project = {
  id: Id<"projects">;
  name: string;
  description: string;
  status: "active" | "archived";
};

type EditorState = { mode: "create" } | { mode: "edit"; project: Project };

export function ProProjectNotice({
  canManageBilling,
  canReadBilling,
  organizationSlug,
}: {
  canManageBilling: boolean;
  canReadBilling: boolean;
  organizationSlug: string;
}) {
  return (
    <section
      aria-labelledby="premium-projects-heading"
      className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-5 text-blue-950 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-100"
      role="status"
    >
      <h2 className="font-semibold" id="premium-projects-heading">
        Pro required for Project changes
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-current/75">
        Existing Projects stay readable on Free. Upgrade this Organization to
        create, edit, archive, or delete Projects.
      </p>
      {canReadBilling ? (
        <Button asChild className="mt-4" size="sm">
          <Link href={`/org/${organizationSlug}/billing` as Route}>
            {canManageBilling ? "View Pro plans" : "Review Billing"}
          </Link>
        </Button>
      ) : (
        <p className="mt-3 text-xs text-current/75">
          Ask an Organization Owner to upgrade.
        </p>
      )}
    </section>
  );
}

function errorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "The Project action could not be completed.";
  }

  return error.message.includes("ORGANIZATION_ACCESS_DENIED")
    ? "Your role does not allow this Project action."
    : error.message.includes("PREMIUM_REQUIRED")
      ? "Pro is required for Project changes. Existing Projects remain available."
      : error.message;
}

export function ProjectManager({
  organizationId,
  organizationSlug,
}: {
  organizationId: Id<"organizations">;
  organizationSlug: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projects = useQuery(api.projects.list, { organizationId });
  const access = useQuery(api.organizationAuthorization.getMine, {
    organizationId,
  });
  const entitlement = useQuery(api.billing.getProjectEntitlement, {
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

  if (
    projects === undefined ||
    access === undefined ||
    entitlement === undefined
  ) {
    return <ProjectsPageSkeleton />;
  }

  const roleCanWrite = access.can.createProjects;
  const hasPro = entitlement.effectivePlan === "premium";
  const canWrite = roleCanWrite && hasPro;
  const canDelete = access.can.deleteProjects && hasPro;
  const queryRequestsCreate = searchParams.get("new") === "1";
  const activeEditor =
    editor ??
    (queryRequestsCreate && canWrite
      ? ({ mode: "create" } satisfies EditorState)
      : null);

  function closeEditor() {
    setEditor(null);
    if (queryRequestsCreate) {
      router.replace(pathname as Route, { scroll: false });
    }
  }

  async function submitProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeEditor) return;
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
      if (activeEditor.mode === "create") {
        await createProject(input);
        setSuccess("Project created.");
      } else {
        await updateProject({ ...input, projectId: activeEditor.project.id });
        setSuccess("Project updated.");
      }
      closeEditor();
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
          <h1 className="dashboard-page-title">Projects</h1>
          <p className="dashboard-page-description mt-1 max-w-2xl">
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

      {roleCanWrite && !hasPro ? (
        <ProProjectNotice
          canManageBilling={access.can.manageBilling}
          canReadBilling={access.can.readBilling}
          organizationSlug={organizationSlug}
        />
      ) : null}

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
              : roleCanWrite && !hasPro
                ? "Projects remain readable on Free. Upgrade to Pro to create the first Project."
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

      <Dialog
        onOpenChange={(open) => {
          if (!open) closeEditor();
        }}
        open={activeEditor !== null}
      >
        {activeEditor ? (
          <DialogContent showCloseButton={false}>
            <DialogHeader className="pr-10">
              <DialogTitle>
                {activeEditor.mode === "create"
                  ? "Create Project"
                  : "Edit Project"}
              </DialogTitle>
              <DialogDescription>
                This record will remain scoped to the active Organization.
              </DialogDescription>
            </DialogHeader>
            <DialogClose asChild>
              <Button
                aria-label="Close Project editor"
                className="absolute top-4 right-4"
                size="icon"
                variant="ghost"
              >
                <X aria-hidden="true" className="size-4" />
              </Button>
            </DialogClose>
            <form className="mt-6 space-y-5" onSubmit={submitProject}>
              <div className="space-y-2">
                <Label htmlFor="project-name">Name</Label>
                <Input
                  autoFocus
                  defaultValue={
                    activeEditor.mode === "edit"
                      ? activeEditor.project.name
                      : ""
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
                    activeEditor.mode === "edit"
                      ? activeEditor.project.description
                      : ""
                  }
                  id="project-description"
                  maxLength={1000}
                  name="description"
                />
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </DialogClose>
                <Button disabled={pending} type="submit">
                  {pending ? "Saving…" : "Save Project"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        ) : null}
      </Dialog>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        open={deleteTarget !== null}
      >
        {deleteTarget ? (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Permanently delete Project?</AlertDialogTitle>
              <AlertDialogDescription className="leading-6">
                {deleteTarget.name} will be removed immediately. This action
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button variant="outline">Cancel</Button>
              </AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button
                  disabled={pending}
                  onClick={() => void confirmDelete()}
                  variant="destructive"
                >
                  {pending ? "Deleting…" : "Delete permanently"}
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        ) : null}
      </AlertDialog>
    </>
  );
}
