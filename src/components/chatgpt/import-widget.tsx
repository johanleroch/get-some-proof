"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImportVideoProgress } from "./import-video-progress";
import { App } from "@modelcontextprotocol/ext-apps";
import type { Id } from "@convex/_generated/dataModel";
import {
  previewSchema,
  importProjectsSchema,
  savedImportSchema,
  importStatusSchema,
  importEligibilitySchema,
  importOperationErrorSchema,
  importOperationErrorMessages,
} from "@/lib/chatgpt/import-wire";
import { TestimonialImportView } from "@/components/testimonials/testimonial-import-view";
import { BlobLoader } from "@/components/brand/blob-loader";
import { FieldError } from "@/components/ui/field";
import type { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

type Preview = z.infer<typeof previewSchema>;
const jobId = "widget-preview" as Id<"testimonialImportJobs">;
const rowId = (position: number) =>
  `preview-${position}` as Id<"testimonialImportItems">;

export function ImportWidget() {
  const bridge = useRef<App | null>(null);
  const callProgressTool = useCallback<App["callServerTool"]>(
    async (args, options) => {
      if (!bridge.current) throw new Error("Host unavailable");
      return bridge.current.callServerTool(args, options);
    },
    [],
  );
  const capability = useRef<string | null>(null);
  const requestVersion = useRef(0);
  const [previewGeneration, setPreviewGeneration] = useState(0);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [connected, setConnected] = useState(false);
  const [choosingProject, setChoosingProject] = useState(false);
  const [projects, setProjects] = useState<z.infer<
    typeof importProjectsSchema
  > | null>(null);
  const [checkingProjectId, setCheckingProjectId] = useState<string | null>(
    null,
  );
  const [projectId, setProjectId] = useState<string | null>(null);
  const [selectionReview, setSelectionReview] = useState<z.infer<
    typeof importEligibilitySchema
  > | null>(null);
  const [saved, setSaved] = useState<z.infer<typeof savedImportSchema> | null>(
    null,
  );
  const updateProgress = useCallback(
    (status: z.infer<typeof importStatusSchema>) => {
      setSaved((previous) =>
        previous?.jobId === status.jobId ? status : previous,
      );
    },
    [],
  );

  const [url, setUrl] = useState("");
  const [provider, setProvider] = useState<"senja" | "testimonial-to">(
    "testimonial-to",
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openingWebsite, setOpeningWebsite] = useState(false);
  const [error, setError] = useState("");
  const [type, setType] = useState<"all" | "text" | "video">("all");
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  function receive(result: {
    structuredContent?: unknown;
    _meta?: Record<string, unknown>;
    isError?: boolean;
  }) {
    if (result.isError)
      throw new Error(
        "The preview could not be updated. Read the wall again or retry.",
      );
    const savedResult = savedImportSchema.safeParse(result.structuredContent);
    if (savedResult.success) {
      setSaved(savedResult.data);
      setChoosingProject(false);
      return;
    }
    const projectResult = importProjectsSchema.safeParse(
      result.structuredContent,
    );
    if (projectResult.success) {
      setProjects(projectResult.data);
      setChoosingProject(true);
      return;
    }
    const snapshot = previewSchema.parse(result.structuredContent);
    const token = result._meta?.previewCapability;
    if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
      throw new Error(
        "The preview session is unavailable. Read the wall again.",
      );
    if (capability.current !== token) {
      setPreviewGeneration((value) => value + 1);
      setSaved(null);
      setChoosingProject(false);
      setProjects(null);
      setProjectId(null);
      setCursors([null]);
      setType("all");
    }
    capability.current = token;
    setPreview(snapshot);
  }
  useEffect(() => {
    const app = new App({ name: "Get Some Proof import", version: "0.1.0" });
    bridge.current = app;
    const theme = (value?: string) =>
      document.documentElement.classList.toggle("dark", value === "dark");
    app.ontoolresult = (result) => {
      requestVersion.current++;
      setLoading(false);
      setSaving(false);
      setOpeningWebsite(false);
      setCheckingProjectId(null);
      try {
        receive(result);
        setError("");
      } catch {
        setError("The preview is unavailable. Read the wall again.");
      }
    };
    app.onhostcontextchanged = (context) => theme(context.theme);
    let active = true;
    void app
      .connect()
      .then(() => {
        if (active) {
          theme(app.getHostContext()?.theme);
          setConnected(true);
        }
      })
      .catch(() => {
        if (active) setError("Open this preview in a connected MCP Apps host.");
      });
    return () => {
      active = false;
      bridge.current = null;
      void app.close();
    };
  }, []);

  async function call(
    name: string,
    args: Record<string, unknown>,
    reading = false,
  ) {
    if (!bridge.current || !connected) return;
    const version = ++requestVersion.current;
    if (reading) setLoading(true);
    else setSaving(true);
    setError("");
    try {
      const result = await bridge.current.callServerTool({
        name,
        arguments: args,
      });
      if (version === requestVersion.current) receive(result);
    } catch {
      if (version === requestVersion.current)
        setError(
          "The preview could not be updated. Your last selection is still shown; retry to confirm its saved state.",
        );
    } finally {
      if (version === requestVersion.current) {
        setLoading(false);
        setSaving(false);
      }
    }
  }

  async function continueOnWebsite() {
    if (!bridge.current || !capability.current || !connected || saving) return;
    const version = ++requestVersion.current;
    setSaving(true);
    setOpeningWebsite(true);
    setError("");
    try {
      const response = await bridge.current.callServerTool({
        name: "continue_testimonial_import",
        arguments: { previewCapability: capability.current },
      });
      if (version !== requestVersion.current) return;
      if (
        response.isError ||
        typeof response._meta?.continuationUrl !== "string"
      )
        throw new Error("Preview unavailable");
      const url = new URL(response._meta.continuationUrl);
      if (
        url.pathname !== "/import/continue" ||
        url.search ||
        url.username ||
        url.password ||
        !/^#preview=[a-f0-9]{64}$/.test(url.hash) ||
        (url.protocol !== "https:" &&
          !(
            url.protocol === "http:" &&
            ["127.0.0.1", "localhost"].includes(url.hostname)
          ))
      )
        throw new Error("Invalid continuation");
      const opened = await bridge.current.openLink({ url: url.href });
      if (opened.isError) throw new Error("Host could not open the website");
    } catch {
      if (version === requestVersion.current)
        setError(
          "The website could not be opened. Your preview is still here; try again.",
        );
    } finally {
      if (version === requestVersion.current) {
        setSaving(false);
        setOpeningWebsite(false);
        setCheckingProjectId(null);
      }
    }
  }

  async function loadProjects(cursor: string | null = null) {
    if (!bridge.current || !connected) return;
    const version = ++requestVersion.current;
    setSaving(true);
    setError("");
    setChoosingProject(true);
    if (!cursor) {
      setSelectionReview(null);
      setProjectId(null);
    }
    try {
      const response = await bridge.current.callServerTool({
        name: "list_import_projects",
        arguments: { cursor },
      });
      if (version !== requestVersion.current) return;
      if (response.isError) {
        setError(
          response._meta?.["mcp/www_authenticate"]
            ? "Complete account connection, then try loading your Projects again."
            : "Projects could not be loaded. Try again.",
        );
        return;
      }
      const next = importProjectsSchema.parse(response.structuredContent);
      setProjects((previous) => ({
        ...next,
        page: cursor ? [...(previous?.page ?? []), ...next.page] : next.page,
      }));
    } catch {
      if (version === requestVersion.current)
        setError("Projects could not be loaded. Try again.");
    } finally {
      if (version === requestVersion.current) setSaving(false);
    }
  }

  async function saveToProject() {
    if (
      !bridge.current ||
      !capability.current ||
      !projectId ||
      saving ||
      !selectionReview ||
      selectionReview.videoCapacityExceeded ||
      !selectionReview.eligibleKeys.length
    )
      return;
    const version = ++requestVersion.current;
    setSaving(true);
    setError("");
    try {
      const response = await bridge.current.callServerTool({
        name: "save_testimonial_import",
        arguments: {
          previewCapability: capability.current,
          organizationId: projectId,
        },
      });
      if (version !== requestVersion.current) return;
      if (response.isError) {
        const code = importOperationErrorSchema.safeParse(
          response._meta?.importError,
        );
        if (code.success) {
          setSelectionReview(null);
          setError(importOperationErrorMessages[code.data]);
          return;
        }
        setError(
          response._meta?.["mcp/www_authenticate"]
            ? "Complete account connection, then retry this import."
            : "The import could not be confirmed. Retry with this Project to recover its result.",
        );
        return;
      }
      setSaved(savedImportSchema.parse(response.structuredContent));
      setChoosingProject(false);
    } catch {
      if (version === requestVersion.current)
        setError(
          "The import could not be confirmed. Retry with this Project to recover its result.",
        );
    } finally {
      if (version === requestVersion.current) setSaving(false);
    }
  }

  async function checkProject(id: string) {
    if (!bridge.current || !capability.current) return;
    const version = ++requestVersion.current;
    setProjectId(id);
    setCheckingProjectId(id);
    setSelectionReview(null);
    setSaving(true);
    setError("");
    try {
      const response = await bridge.current.callServerTool({
        name: "check_import_selection",
        arguments: {
          previewCapability: capability.current,
          organizationId: id,
        },
      });
      if (version !== requestVersion.current) return;
      if (response.isError) throw new Error("Selection unavailable");
      setSelectionReview(
        importEligibilitySchema.parse(response.structuredContent),
      );
    } catch {
      if (version === requestVersion.current)
        setError(
          "Your selection could not be checked. Select the Project again to retry.",
        );
    } finally {
      if (version === requestVersion.current) {
        setSaving(false);
        setCheckingProjectId(null);
      }
    }
  }

  function readPage(next: (string | null)[], format: "all" | "text" | "video") {
    setCursors(next);
    setType(format);
    if (capability.current)
      void call("read_testimonial_preview", {
        previewCapability: capability.current,
        offset: Number(next.at(-1) ?? 0),
        type: format === "all" ? undefined : format,
      });
  }
  if (!connected)
    return (
      <main className="bg-paper p-5">
        <BlobLoader label="Connecting to host…" showLabel />
        <FieldError>{error}</FieldError>
      </main>
    );

  return (
    <main className="bg-paper text-ink p-5 md:p-8 [&_button:not([role=checkbox])]:min-h-11 [&_label:has([role=checkbox])]:min-h-11 [&_label:has([role=checkbox])]:min-w-11">
      {choosingProject && !saved ? (
        <section className="mx-auto grid w-full max-w-2xl gap-6">
          <PageHeader
            title="Choose a Project"
            description="Your selected testimonials will be saved in its Inbox as Pending. You can review them before publishing."
          />
          <FieldError>{error}</FieldError>
          {projects?.page.length ? (
            <ul className="divide-line border-line bg-surface divide-y rounded-lg border">
              {projects.page.map((project) => (
                <li key={project.id} className="p-3">
                  <Button
                    variant="ghost"
                    className="aria-pressed:bg-brand-soft w-full justify-start"
                    aria-pressed={projectId === project.id}
                    loading={checkingProjectId === project.id}
                    disabled={saving}
                    onClick={() => void checkProject(project.id)}
                  >
                    {project.name}
                  </Button>
                  {projectId === project.id && (
                    <p
                      className="type-small text-ink-2 px-4 pt-2 max-md:text-sm"
                      aria-live="polite"
                    >
                      {!project.videoCapacity
                        ? "Video capacity could not be checked. Reload Projects before importing videos."
                        : !project.videoCapacity.configured
                          ? "Video import is unavailable. Return to selection to import text testimonials."
                          : !project.videoCapacity.available
                            ? "Video storage is unavailable for this account. Return to selection to import text testimonials."
                            : `${Math.max(0, project.videoCapacity.limit - project.videoCapacity.used)} of ${project.videoCapacity.limit} video storage places available across your account. Capacity is checked again when you import.`}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="type-body text-ink-2">
              {projects
                ? "No active Project is available. Continue on the website to create one with your preview."
                : "Connect your account to see your Projects."}
            </p>
          )}
          {projects && !projects.isDone && (
            <Button
              variant="outline"
              loading={saving && !openingWebsite && !checkingProjectId}
              disabled={saving}
              onClick={() => void loadProjects(projects.continueCursor)}
            >
              Load more Projects
            </Button>
          )}
          <div className="flex flex-wrap gap-3">
            {selectionReview && (
              <div className="type-body w-full" aria-live="polite">
                <p>
                  {selectionReview.text + selectionReview.video} importable:{" "}
                  {selectionReview.text} text · {selectionReview.video} video
                </p>
                <p className="type-small text-ink-2 mt-2 max-md:text-sm">
                  {selectionReview.duplicates} already imported ·{" "}
                  {selectionReview.changed} changed at source ·{" "}
                  {selectionReview.unavailable} unavailable ·{" "}
                  {selectionReview.videoCapacityExceeded} videos without storage
                </p>
                {selectionReview.videoCapacityExceeded > 0 && (
                  <p className="type-small text-ink-2 mt-2 max-md:text-sm">
                    Return to selection to choose which videos to import.
                  </p>
                )}
              </div>
            )}
            <Button
              variant="ghost"
              disabled={saving}
              onClick={() => {
                setChoosingProject(false);
                setSelectionReview(null);
                setProjectId(null);
                setError("");
              }}
            >
              Back to selection
            </Button>
            <Button
              variant="outline"
              loading={saving && !openingWebsite && !checkingProjectId}
              disabled={saving}
              onClick={() => void loadProjects()}
            >
              Reload Projects
            </Button>
            <Button
              variant="outline"
              loading={openingWebsite}
              disabled={saving}
              onClick={() => void continueOnWebsite()}
            >
              Continue on website
            </Button>
            {projectId && (
              <Button
                loading={saving && !openingWebsite && !checkingProjectId}
                disabled={
                  saving ||
                  !selectionReview ||
                  selectionReview.videoCapacityExceeded > 0 ||
                  !selectionReview.eligibleKeys.length
                }
                onClick={() => void saveToProject()}
              >
                Import testimonials
              </Button>
            )}
          </div>
        </section>
      ) : (
        <TestimonialImportView
          key={previewGeneration}
          publicPreview
          navigation={
            <div className="flex flex-wrap items-center gap-3">
              <span className="type-ui text-ink-2">Get Some Proof</span>
              {preview && !saved && (
                <Button
                  variant="ghost"
                  loading={openingWebsite}
                  disabled={saving}
                  onClick={() => void continueOnWebsite()}
                >
                  Continue on website
                </Button>
              )}
            </div>
          }
          slug={saved?.organizationSlug ?? ""}
          inboxAction={
            saved ? (
              <Button
                onClick={() => {
                  const url = new URL(saved.inboxUrl);
                  if (
                    url.protocol === "https:" ||
                    (url.protocol === "http:" &&
                      ["127.0.0.1", "localhost"].includes(url.hostname))
                  )
                    void bridge.current?.openLink({ url: url.href });
                }}
              >
                Open Inbox
              </Button>
            ) : undefined
          }
          jobId={preview ? jobId : null}
          provider={preview?.provider ?? provider}
          setProvider={setProvider}
          url={url}
          setUrl={setUrl}
          loading={loading}
          saving={saving || !connected}
          saveLoading={saving && !openingWebsite}
          error={error}
          result={saved?.result ?? null}
          resultDetails={
            saved ? (
              <ImportVideoProgress
                key={saved.jobId}
                jobId={saved.jobId}
                callTool={callProgressTool}
                onUpdate={updateProgress}
              />
            ) : undefined
          }
          typeFilter={type}
          onTypeFilterChange={(value) => {
            readPage([null], value);
          }}
          cursors={cursors}
          setCursors={(next) =>
            readPage(typeof next === "function" ? next(cursors) : next, type)
          }
          selected={new Set((preview?.selectedPositions ?? []).map(rowId))}
          onPhoto={async (id, photo) => {
            if (!bridge.current || !capability.current || !connected)
              throw new Error("The preview session is unavailable.");
            const version = ++requestVersion.current;
            const photoCapability = capability.current;
            const imageBase64 = photo
              ? await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () =>
                    resolve(String(reader.result).split(",")[1]!);
                  reader.onerror = () =>
                    reject(new Error("The photo could not be read."));
                  reader.readAsDataURL(photo);
                })
              : null;
            if (
              version !== requestVersion.current ||
              photoCapability !== capability.current
            )
              throw new Error("The preview changed. Choose the photo again.");
            const response = await bridge.current.callServerTool({
              name: "set_testimonial_photo",
              arguments: {
                previewCapability: photoCapability,
                position: Number(id.slice(8)),
                imageBase64,
                offset: Number(cursors.at(-1) ?? 0),
                type: type === "all" ? undefined : type,
              },
            });
            if (version !== requestVersion.current || response.isError)
              throw new Error(
                "The photo could not be saved. Check the preview and try again.",
              );
            receive(response);
          }}
          onCorrectIdentity={async (id, identity) => {
            if (!bridge.current || !capability.current || !connected)
              throw new Error("The preview session is unavailable.");
            const version = ++requestVersion.current;
            const response = await bridge.current.callServerTool({
              name: "correct_testimonial_identity",
              arguments: {
                previewCapability: capability.current,
                position: Number(id.slice(8)),
                ...identity,
                offset: Number(cursors.at(-1) ?? 0),
                type: type === "all" ? undefined : type,
              },
            });
            if (version !== requestVersion.current)
              throw new Error(
                "The preview changed. Check the current customer details.",
              );
            receive(response);
          }}
          changeSelection={(selection) => {
            if (capability.current)
              void call("select_testimonial_preview", {
                previewCapability: capability.current,
                positions: [...selection].map((id) => Number(id.slice(8))),
                offset: Number(cursors.at(-1) ?? 0),
                type: type === "all" ? undefined : type,
              });
          }}
          backToUrl={() => {
            requestVersion.current++;
            setLoading(false);
            setSaving(false);
            setOpeningWebsite(false);
            setCheckingProjectId(null);
            capability.current = null;
            setPreview(null);
            setSaved(null);
            setProjects(null);
            setProjectId(null);
            setChoosingProject(false);
            setCursors([null]);
            setType("all");
            setError("");
          }}
          read={async () => {
            setCursors([null]);
            setType("all");
            await call("preview_testimonial_wall", { url }, true);
          }}
          save={async () => {
            await loadProjects();
          }}
          preview={
            preview
              ? {
                  ...preview,
                  result: null,
                  selectedItemIds: preview.selectedPositions.map(rowId),
                  videoCapacity: {
                    used: 0,
                    limit: 0,
                    configured: false,
                    available: true,
                  },
                  items: {
                    page: preview.items.map((item) => ({
                      ...item,
                      _id: rowId(item.position),
                      _creationTime: 0,
                      organizationId: "widget-preview" as Id<"organizations">,
                      jobId,
                    })),
                    isDone: preview.nextOffset === null,
                    continueCursor: String(preview.nextOffset ?? ""),
                  },
                }
              : undefined
          }
        />
      )}
    </main>
  );
}
