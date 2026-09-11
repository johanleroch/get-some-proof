"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import {
  useAction,
  useConvexAuth,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { authClient } from "@/lib/auth-client";
import { convexErrorMessage } from "@/lib/convex-error-message";
import { PageHeader } from "@/components/page-header";
import { BlobLoader } from "@/components/brand/blob-loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field, FieldError } from "@/components/ui/field";
import { TestimonialImportView } from "./testimonial-import";

import { importPreviewSessionKey as sessionKey } from "@/lib/import-preview-session";
const sessionEvent = "gsp-wall-import-changed";
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(sessionEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(sessionEvent, onChange);
  };
}
function snapshot() {
  try {
    return localStorage.getItem(sessionKey);
  } catch {
    return null;
  }
}
function remember(value: { token: string; resume: boolean } | null) {
  if (value) localStorage.setItem(sessionKey, JSON.stringify(value));
  else localStorage.removeItem(sessionKey);
  window.dispatchEvent(new Event(sessionEvent));
}
function readSession(
  raw: string | null,
): { token: string; resume: boolean } | null {
  try {
    const value: unknown = raw ? JSON.parse(raw) : null;
    if (
      value &&
      typeof value === "object" &&
      "token" in value &&
      typeof value.token === "string" &&
      /^[a-f0-9]{64}$/.test(value.token)
    )
      return {
        token: value.token,
        resume: "resume" in value && value.resume === true,
      };
  } catch {
    /* Invalid browser state is an empty session. */
  }
  return null;
}
const previewId = "anonymous-preview" as Id<"testimonialImportJobs">;
function rowId(position: number) {
  return `preview-${position}` as Id<"testimonialImportItems">;
}

export function PublicTestimonialImport({
  handoffFailed = false,
}: {
  handoffFailed?: boolean;
}) {
  const router = useRouter();
  const stored = useSyncExternalStore(subscribe, snapshot, () => null);
  const session = readSession(stored);
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const authSession = authClient.useSession();
  const verified =
    isAuthenticated && authSession.data?.user.emailVerified === true;
  const [provider, setProvider] = useState<"senja" | "testimonial-to">(
    "testimonial-to",
  );
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(
    handoffFailed
      ? "Your preview could not be opened in this browser. Return to ChatGPT and try again."
      : "",
  );
  const [typeFilter, setTypeFilter] = useState<"all" | "text" | "video">("all");
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [projectName, setProjectName] = useState("");
  const [pendingDestination, setPendingDestination] = useState<string | null>(
    null,
  );
  const createdDestination = useRef<{
    id: Id<"organizations">;
    slug: string;
    name: string;
  } | null>(null);
  const request = useRef(0);
  const previewSource = useAction(api.testimonialImportSource.previewAnonymous);
  const uploadPhoto = useAction(api.importAvatarUpload.upload);
  const generatePhotoUploadUrl = useMutation(
    api.importAvatarUpload.generateUploadUrl,
  );
  const removePhoto = useMutation(api.importAvatarUpload.remove);
  const correctIdentity = useMutation(api.anonymousWallImports.correctIdentity);
  const select = useMutation(api.anonymousWallImports.select);
  const claim = useMutation(api.anonymousWallImports.claim);
  const createProject = useMutation(api.organizations.create);
  const preview = useQuery(
    api.anonymousWallImports.read,
    session
      ? {
          token: session.token,
          offset: Number(cursors[cursors.length - 1] ?? 0),
          type: typeFilter === "all" ? undefined : typeFilter,
        }
      : "skip",
  );
  const resumed = useQuery(
    api.anonymousWallImports.resume,
    session && verified ? { token: session.token } : "skip",
  );
  const destinations = usePaginatedQuery(
    api.anonymousWallImports.destinations,
    session?.resume && verified ? {} : "skip",
    { initialNumItems: 20 },
  );

  useEffect(() => {
    if (!resumed) return;
    remember(null);
    router.replace(
      `/org/${resumed.organizationSlug}/import?job=${resumed.jobId}` as Route,
    );
  }, [resumed, router]);

  function startAgain() {
    request.current++;
    remember(null);
    setCursors([null]);
    setTypeFilter("all");
    setError("");
    setLoading(false);
  }
  async function read() {
    const current = ++request.current;
    setLoading(true);
    setError("");
    try {
      const result = await previewSource({ url });
      if (current !== request.current) return;
      remember({ token: result.token, resume: false });
      setCursors([null]);
    } catch (cause) {
      if (current === request.current)
        setError(
          convexErrorMessage(
            cause,
            "The wall could not be read. Check the URL and try again.",
          ),
        );
    } finally {
      if (current === request.current) setLoading(false);
    }
  }
  async function changeSelection(selected: Set<Id<"testimonialImportItems">>) {
    if (!session || saving) return;
    setSaving(true);
    setError("");
    try {
      await select({
        token: session.token,
        positions: [...selected].map((id) =>
          Number(id.slice("preview-".length)),
        ),
      });
    } catch (cause) {
      setError(convexErrorMessage(cause, "Your selection could not be saved."));
    } finally {
      setSaving(false);
    }
  }
  async function chooseProject(
    project: { id: Id<"organizations">; slug: string },
    creating = false,
  ) {
    if (!session) return;
    setSaving(true);
    if (!creating) setPendingDestination(project.id);
    setError("");
    try {
      const { jobId } = await claim({
        token: session.token,
        organizationId: project.id,
      });
      remember(null);
      router.push(`/org/${project.slug}/import?job=${jobId}` as Route);
    } catch (cause) {
      setError(
        convexErrorMessage(
          cause,
          "The preview could not be saved to this Project.",
        ),
      );
    } finally {
      setSaving(false);
      setPendingDestination(null);
    }
  }
  async function createDestination() {
    setSaving(true);
    setPendingDestination("new");
    setError("");
    try {
      const name = projectName.trim();
      // If saving the preview fails after creation, retry the same Project.
      if (createdDestination.current?.name !== name) {
        createdDestination.current = {
          ...(await createProject({ name })),
          name,
        };
      }
      await chooseProject(createdDestination.current, true);
    } catch (cause) {
      setError(convexErrorMessage(cause, "The Project could not be created."));
    } finally {
      setSaving(false);
      setPendingDestination(null);
    }
  }

  if (session && (authLoading || (verified && resumed === undefined)))
    return <BlobLoader label="Loading your preview…" showLabel />;
  if (session?.resume && preview)
    return (
      <div className="mx-auto grid max-w-2xl gap-8">
        <PageHeader
          title="Save your testimonials"
          description={`${preview.selectedPositions.length} selected. Choose a Project, then review before importing.`}
        />
        <FieldError>{error}</FieldError>
        {!verified ? (
          <section className="grid gap-6">
            <p className="type-body text-ink-2">
              Your preview is saved until{" "}
              {new Date(preview.expiresAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
              . Return here after verifying your email.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/sign-up?callbackURL=%2Fimport">
                  Create account
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/sign-in?callbackURL=%2Fimport">Sign in</Link>
              </Button>
            </div>
          </section>
        ) : (
          <section className="grid gap-6">
            {destinations.status === "LoadingFirstPage" ? (
              <BlobLoader label="Loading your Projects…" showLabel />
            ) : (
              <>
                {destinations.results.length > 0 && (
                  <ul className="divide-line bg-surface border-line divide-y rounded-lg border">
                    {destinations.results.map((project) => (
                      <li
                        key={project.id}
                        className="flex flex-wrap items-center justify-between gap-4 p-4"
                      >
                        <span className="type-ui font-semibold">
                          {project.name}
                        </span>
                        <Button
                          variant="outline"
                          loading={pendingDestination === project.id}
                          disabled={saving}
                          onClick={() => void chooseProject(project)}
                        >
                          Use this Project
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                {destinations.status !== "Exhausted" && (
                  <Button
                    variant="ghost"
                    disabled={saving}
                    loading={destinations.status === "LoadingMore"}
                    onClick={() => destinations.loadMore(20)}
                  >
                    More Projects
                  </Button>
                )}
                <form
                  className="grid gap-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void createDestination();
                  }}
                >
                  <Field>
                    <Label htmlFor="import-project-name">
                      New Project name
                    </Label>
                    <Input
                      id="import-project-name"
                      value={projectName}
                      onChange={(event) => setProjectName(event.target.value)}
                      required
                      maxLength={100}
                      disabled={saving}
                      placeholder="Willow Ceramics"
                    />
                  </Field>
                  <Button
                    className="w-fit"
                    loading={pendingDestination === "new"}
                    disabled={saving || !projectName.trim()}
                  >
                    Create Project and continue
                  </Button>
                </form>
              </>
            )}
          </section>
        )}
        <Button
          className="w-fit"
          variant="ghost"
          disabled={saving}
          onClick={() => remember({ token: session.token, resume: false })}
        >
          Back to preview
        </Button>
      </div>
    );

  return (
    <TestimonialImportView
      publicPreview
      slug=""
      jobId={session ? previewId : null}
      provider={preview?.provider ?? provider}
      setProvider={setProvider}
      url={url}
      setUrl={setUrl}
      loading={loading}
      saving={saving}
      error={error}
      result={null}
      typeFilter={typeFilter}
      onTypeFilterChange={(type) => {
        setTypeFilter(type);
        setCursors([null]);
      }}
      cursors={cursors}
      setCursors={setCursors}
      selected={new Set((preview?.selectedPositions ?? []).map(rowId))}
      onPhoto={async (itemId, photo) => {
        const target = {
          token: session!.token,
          position: Number(itemId.slice("preview-".length)),
        };
        if (photo) {
          const uploadUrl = await generatePhotoUploadUrl({ target });
          const response = await fetch(uploadUrl, {
            body: photo,
            headers: { "Content-Type": photo.type },
            method: "POST",
          });
          if (!response.ok) throw new Error("IMAGE_UPLOAD_FAILED");
          const { storageId } = (await response.json()) as {
            storageId: Id<"_storage">;
          };
          await uploadPhoto({ target, temporaryStorageId: storageId });
        } else await removePhoto({ target });
      }}
      onCorrectIdentity={async (itemId, identity) => {
        if (!session) throw new Error("The preview is unavailable.");
        await correctIdentity({
          token: session.token,
          position: Number(itemId.slice("preview-".length)),
          ...identity,
        });
      }}
      changeSelection={(selected) => void changeSelection(selected)}
      backToUrl={startAgain}
      read={read}
      save={async () => {
        if (session) remember({ token: session.token, resume: true });
      }}
      preview={
        preview === undefined
          ? undefined
          : preview === null
            ? null
            : {
                ...preview,
                result: null,
                selectedItemIds: preview.selectedPositions.map(rowId),
                videoCapacity: {
                  used: 0,
                  limit: 0,
                  available: true,
                  configured: false,
                },
                items: {
                  page: preview.items.map((item) => ({
                    ...item,
                    _id: rowId(item.position),
                    _creationTime: 0,
                    jobId: previewId,
                    organizationId: "anonymous-preview" as Id<"organizations">,
                  })),
                  isDone: preview.nextOffset === null,
                  continueCursor: String(preview.nextOffset ?? ""),
                },
              }
      }
    />
  );
}
