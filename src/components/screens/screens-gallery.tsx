"use client";

import {
  Component,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  IconExternalLink,
  IconFlask,
  IconLock,
  IconRefresh,
} from "@tabler/icons-react";
import { useConvexAuth, useQuery } from "convex/react";
import { toast } from "sonner";

import { api } from "@convex/_generated/api";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  artboardMinHeight,
  artboardWidth,
  resolveLivePath,
  type ScreenDefinition,
  type ScreenOrganization,
  type ScreenSection,
  type ScreenStatus,
  type ScreenStatuses,
} from "@/lib/screens-catalog";
import {
  applyThemePreference,
  readThemePreference,
  themeChangeEvent,
} from "@/lib/theme";
import { cn } from "@/lib/utils";

const artboardMaxHeight = 3200;
const zoomStorageKey = "get-some-proof-screens-zoom";
const zoomChangeEvent = "get-some-proof-screens-zoom-change";
const zoomLevels = ["fit", "50", "75", "100"] as const;

type ZoomLevel = (typeof zoomLevels)[number];
type ScreenSource = "fixture" | "live";
type SessionState =
  "loading" | "no-brand" | "ready" | "signed-out" | "unavailable";

function isZoomLevel(value: string | null): value is ZoomLevel {
  return zoomLevels.includes(value as ZoomLevel);
}

function readZoom(): ZoomLevel {
  try {
    const stored = localStorage.getItem(zoomStorageKey);
    return isZoomLevel(stored) ? stored : "fit";
  } catch {
    return "fit";
  }
}

function subscribeToZoom(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(zoomChangeEvent, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(zoomChangeEvent, onStoreChange);
  };
}

function writeZoom(next: ZoomLevel) {
  try {
    localStorage.setItem(zoomStorageKey, next);
  } catch {
    // Storage can be unavailable; the event still updates this visit.
  }
  window.dispatchEvent(new Event(zoomChangeEvent));
}

function applyThemeToFrame(frame: HTMLIFrameElement) {
  try {
    const root = frame.contentDocument?.documentElement;
    if (!root) return;
    applyThemePreference(
      root,
      readThemePreference(),
      window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false,
    );
  } catch {
    // Cross-origin frames cannot be themed; every gallery frame is same-origin.
  }
}

const statusDotClass: Record<ScreenStatus, string> = {
  ok: "bg-emerald-500",
  todo: "bg-amber-500",
};

const statusLabel: Record<ScreenStatus, string> = {
  ok: "OK",
  todo: "To change",
};

type ScreensGalleryProps = {
  fixturesEnabled: boolean;
  initialStatuses: ScreenStatuses;
  liveEnabled: boolean;
  sections: ScreenSection[];
};

export function ScreensGallery({
  fixturesEnabled,
  initialStatuses,
  liveEnabled,
  sections,
}: ScreensGalleryProps) {
  const fallback = (
    <GalleryView
      fixturesEnabled={fixturesEnabled}
      initialStatuses={initialStatuses}
      organization={null}
      sections={sections}
      sessionState={liveEnabled ? "signed-out" : "unavailable"}
    />
  );
  return liveEnabled ? (
    <SessionErrorBoundary fallback={fallback}>
      <GalleryWithSession
        fixturesEnabled={fixturesEnabled}
        initialStatuses={initialStatuses}
        sections={sections}
      />
    </SessionErrorBoundary>
  ) : (
    fallback
  );
}

// A stale session makes `organizations.listMine` throw inside render; the
// gallery must keep working with sample screens in that case.
class SessionErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function GalleryWithSession({
  fixturesEnabled,
  initialStatuses,
  sections,
}: Omit<ScreensGalleryProps, "liveEnabled">) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const organizations = useQuery(
    api.organizations.listMine,
    isAuthenticated ? {} : "skip",
  );
  const first = organizations?.[0];
  const organization = useMemo<ScreenOrganization | null>(
    () =>
      first
        ? { name: first.name, publicSlug: first.publicSlug, slug: first.slug }
        : null,
    [first],
  );
  const sessionState: SessionState = isLoading
    ? "loading"
    : !isAuthenticated
      ? "signed-out"
      : organizations === undefined
        ? "loading"
        : organization
          ? "ready"
          : "no-brand";

  return (
    <GalleryView
      fixturesEnabled={fixturesEnabled}
      initialStatuses={initialStatuses}
      organization={organization}
      sections={sections}
      sessionState={sessionState}
    />
  );
}

type GalleryViewProps = {
  fixturesEnabled: boolean;
  initialStatuses: ScreenStatuses;
  organization: ScreenOrganization | null;
  sections: ScreenSection[];
  sessionState: SessionState;
};

function GalleryView({
  fixturesEnabled,
  initialStatuses,
  organization,
  sections,
  sessionState,
}: GalleryViewProps) {
  const zoom = useSyncExternalStore(
    subscribeToZoom,
    readZoom,
    (): ZoomLevel => "fit",
  );
  const [reloadKey, setReloadKey] = useState(0);
  const [statuses, setStatuses] = useState<ScreenStatuses>(initialStatuses);

  useEffect(() => {
    const syncFrames = () => {
      document
        .querySelectorAll<HTMLIFrameElement>("iframe[data-screen-frame]")
        .forEach(applyThemeToFrame);
    };
    window.addEventListener(themeChangeEvent, syncFrames);
    window.addEventListener("storage", syncFrames);
    return () => {
      window.removeEventListener(themeChangeEvent, syncFrames);
      window.removeEventListener("storage", syncFrames);
    };
  }, []);

  const updateStatus = useCallback(
    async (slug: string, status: ScreenStatus | null) => {
      let previous: ScreenStatuses = {};
      setStatuses((current) => {
        previous = current;
        const next = { ...current };
        if (status) next[slug] = status;
        else delete next[slug];
        return next;
      });
      try {
        const response = await fetch("/api/screens/status", {
          body: JSON.stringify({ slug, status }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as { statuses: ScreenStatuses };
        setStatuses(data.statuses);
      } catch {
        setStatuses(previous);
        toast.error("Could not save the screen status.");
      }
    },
    [],
  );

  const numbers = useMemo(() => {
    const map = new Map<string, number>();
    let index = 0;
    for (const section of sections) {
      for (const screen of section.screens) map.set(screen.slug, ++index);
    }
    return map;
  }, [sections]);
  const counts = useMemo(() => {
    let ok = 0;
    let todo = 0;
    for (const slug of numbers.keys()) {
      if (statuses[slug] === "ok") ok += 1;
      if (statuses[slug] === "todo") todo += 1;
    }
    return { ok, todo };
  }, [numbers, statuses]);

  return (
    <div className="bg-background text-foreground min-h-svh">
      <header className="bg-background/85 sticky top-0 z-20 border-b backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-3 px-6 py-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-semibold">Screens</h1>
            <p className="text-muted-foreground text-xs">
              {numbers.size} screens · {artboardWidth}px artboards · development
              only
            </p>
          </div>
          <StatusSummary
            ok={counts.ok}
            todo={counts.todo}
            total={numbers.size}
          />
          <SessionStatus organization={organization} state={sessionState} />
          <SegmentedControl
            ariaLabel="Zoom"
            onChange={writeZoom}
            options={zoomLevels.map((level) => ({
              label: level === "fit" ? "Fit" : `${level}%`,
              value: level,
            }))}
            value={zoom}
          />
          <Button
            onClick={() => setReloadKey((key) => key + 1)}
            size="sm"
            variant="outline"
          >
            <IconRefresh aria-hidden="true" />
            Reload all
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto flex max-w-[1600px] gap-10 px-6 py-8">
        <nav
          aria-label="Screens"
          className="sticky top-[81px] hidden max-h-[calc(100svh-97px)] w-52 shrink-0 self-start overflow-y-auto lg:block"
        >
          {sections.map((section) => (
            <div className="mb-5" key={section.id}>
              <a
                className="text-muted-foreground hover:text-foreground block text-[11px] font-semibold tracking-wide uppercase transition-colors"
                href={`#${section.id}`}
              >
                {section.title}
              </a>
              <ul className="mt-1.5 space-y-0.5">
                {section.screens.map((screen) => {
                  const status = statuses[screen.slug];
                  return (
                    <li key={screen.slug}>
                      <a
                        className="text-muted-foreground hover:text-foreground hover:bg-accent flex items-center gap-2 rounded-md px-2 py-1 text-xs transition-colors"
                        href={`#${screen.slug}`}
                      >
                        <span className="font-mono text-[10px] tabular-nums opacity-60">
                          {String(numbers.get(screen.slug)).padStart(2, "0")}
                        </span>
                        <span className="truncate">{screen.title}</span>
                        <span
                          aria-label={status ? statusLabel[status] : undefined}
                          className={cn(
                            "ml-auto size-1.5 shrink-0 rounded-full",
                            status
                              ? statusDotClass[status]
                              : "border-muted-foreground/40 border",
                          )}
                          role={status ? "img" : undefined}
                        />
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="min-w-0 flex-1">
          {!fixturesEnabled ? (
            <p
              className="border-destructive/30 bg-destructive/5 text-destructive mb-8 rounded-lg border px-4 py-3 text-sm"
              role="status"
            >
              Sample-data previews are off. Add{" "}
              <code className="font-mono text-xs">
                VISUAL_EVIDENCE_FIXTURES=true
              </code>{" "}
              to <code className="font-mono text-xs">.env.local</code> and
              restart the dev server.
            </p>
          ) : null}
          {sections.map((section) => (
            <section
              aria-labelledby={`${section.id}-title`}
              className="mb-16 scroll-mt-24"
              id={section.id}
              key={section.id}
            >
              <h2
                className="text-muted-foreground mb-5 text-xs font-semibold tracking-wide uppercase"
                id={`${section.id}-title`}
              >
                {section.title}
              </h2>
              <div className="space-y-12">
                {section.screens.map((screen) => (
                  <ScreenPanel
                    fixturesEnabled={fixturesEnabled}
                    key={screen.slug}
                    number={numbers.get(screen.slug) ?? 0}
                    onStatusChange={updateStatus}
                    organization={organization}
                    reloadKey={reloadKey}
                    screen={screen}
                    sessionState={sessionState}
                    status={statuses[screen.slug] ?? null}
                    zoom={zoom}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusSummary({
  ok,
  todo,
  total,
}: {
  ok: number;
  todo: number;
  total: number;
}) {
  return (
    <p className="text-muted-foreground hidden items-center gap-3 text-xs md:flex">
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className={cn("size-1.5 rounded-full", statusDotClass.ok)}
        />
        {ok} OK
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className={cn("size-1.5 rounded-full", statusDotClass.todo)}
        />
        {todo} to change
      </span>
      <span>{total - ok - todo} to review</span>
    </p>
  );
}

function SessionStatus({
  organization,
  state,
}: {
  organization: ScreenOrganization | null;
  state: SessionState;
}) {
  const label =
    state === "ready" && organization
      ? `Live as ${organization.name}`
      : state === "signed-out"
        ? "Signed out · live previews off"
        : state === "no-brand"
          ? "No Brand yet · live previews off"
          : state === "loading"
            ? "Checking session…"
            : "Backend not configured";

  return (
    <span
      className={cn(
        "hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs md:inline-flex",
        state === "ready"
          ? "text-foreground"
          : "text-muted-foreground border-dashed",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 rounded-full",
          state === "ready" ? "bg-emerald-500" : "bg-muted-foreground/50",
        )}
      />
      {label}
    </span>
  );
}

function SegmentedControl<T extends string>({
  ariaLabel,
  onChange,
  options,
  value,
}: {
  ariaLabel: string;
  onChange: (value: T) => void;
  options: Array<{ disabled?: boolean; label: string; value: T }>;
  value: T;
}) {
  return (
    <div
      aria-label={ariaLabel}
      className="bg-muted inline-flex items-center gap-0.5 rounded-md p-0.5"
      role="radiogroup"
    >
      {options.map((option) => (
        <button
          aria-checked={option.value === value}
          className={cn(
            "focus-visible:ring-ring/50 h-7 rounded-[5px] px-2.5 text-xs font-medium transition-colors outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-40",
            option.value === value
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
          disabled={option.disabled}
          key={option.value}
          onClick={() => onChange(option.value)}
          role="radio"
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function StatusPills({
  onChange,
  value,
}: {
  onChange: (status: ScreenStatus | null) => void;
  value: ScreenStatus | null;
}) {
  return (
    <div className="inline-flex items-center gap-1.5" role="group">
      {(["todo", "ok"] as const).map((status) => {
        const active = value === status;
        return (
          <button
            aria-pressed={active}
            className={cn(
              "focus-visible:ring-ring/50 inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors outline-none focus-visible:ring-[3px]",
              active
                ? status === "ok"
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                  : "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
            key={status}
            onClick={() => onChange(active ? null : status)}
            type="button"
          >
            <span
              aria-hidden="true"
              className={cn(
                "size-1.5 rounded-full",
                active ? statusDotClass[status] : "bg-muted-foreground/40",
              )}
            />
            {statusLabel[status]}
          </button>
        );
      })}
    </div>
  );
}

type ScreenPanelProps = {
  fixturesEnabled: boolean;
  number: number;
  onStatusChange: (slug: string, status: ScreenStatus | null) => void;
  organization: ScreenOrganization | null;
  reloadKey: number;
  screen: ScreenDefinition;
  sessionState: SessionState;
  status: ScreenStatus | null;
  zoom: ZoomLevel;
};

function ScreenPanel({
  fixturesEnabled,
  number,
  onStatusChange,
  organization,
  reloadKey,
  screen,
  sessionState,
  status,
  zoom,
}: ScreenPanelProps) {
  const hasFixture = Boolean(screen.fixturePath);
  const livePath = screen.livePath
    ? resolveLivePath(screen.livePath, organization)
    : null;
  const liveBlocked = !screen.livePath
    ? "No live route for this state."
    : sessionState === "unavailable"
      ? "Backend not configured."
      : screen.requiresAuth && sessionState === "signed-out"
        ? "Sign in to preview the live screen."
        : screen.requiresAuth && sessionState === "loading"
          ? "Checking your session…"
          : livePath === null
            ? sessionState === "no-brand" || sessionState === "signed-out"
              ? "Create your Brand to preview the live screen."
              : sessionState === "loading"
                ? "Checking your session…"
                : "This route needs a private token."
            : null;
  const [source, setSource] = useState<ScreenSource>(
    hasFixture ? "fixture" : "live",
  );
  const [panelReload, setPanelReload] = useState(0);
  const [measured, setMeasured] = useState<{ key: string; value: number }>({
    key: "",
    value: artboardMinHeight,
  });
  const [areaWidth, setAreaWidth] = useState<number | null>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  const activeSource: ScreenSource =
    source === "live" && liveBlocked ? "fixture" : source;
  const src =
    activeSource === "fixture"
      ? fixturesEnabled
        ? (screen.fixturePath ?? null)
        : null
      : livePath;
  const frameKey = `${screen.slug}:${activeSource}:${reloadKey}:${panelReload}`;
  const height = measured.key === frameKey ? measured.value : artboardMinHeight;

  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setAreaWidth(entry.contentRect.width);
    });
    observer.observe(area);
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  const handleLoad = useCallback(() => {
    const frame = frameRef.current;
    if (!frame) return;
    applyThemeToFrame(frame);
    try {
      const body = frame.contentDocument?.body;
      const root = frame.contentDocument?.documentElement;
      if (!body || !root) return;
      const style = frame.contentDocument.createElement("style");
      style.textContent = "nextjs-portal { display: none !important; }";
      frame.contentDocument.head.append(style);
      const measure = () => {
        const next = Math.max(root.scrollHeight, body.scrollHeight);
        setMeasured({
          key: frameKey,
          value: Math.min(artboardMaxHeight, Math.max(artboardMinHeight, next)),
        });
      };
      measure();
      observerRef.current?.disconnect();
      observerRef.current = new ResizeObserver(measure);
      observerRef.current.observe(body);
    } catch {
      // Same-origin frames only; keep the default artboard height otherwise.
    }
  }, [frameKey]);

  // "Fit" scales the artboard to the frame's inner width so nothing overflows;
  // fixed zoom levels may overflow and scroll inside their own frame.
  const scaledWidth =
    zoom === "fit"
      ? areaWidth === null
        ? null
        : Math.floor(Math.min(areaWidth, artboardWidth))
      : Math.round((artboardWidth * Number(zoom)) / 100);
  const scale = scaledWidth === null ? null : scaledWidth / artboardWidth;
  const scaledHeight = scale === null ? null : Math.round(height * scale);
  const displayPath = src ?? screen.fixturePath ?? screen.livePath ?? "";
  const unavailableReason =
    activeSource === "fixture" && !fixturesEnabled
      ? "Sample-data previews are off for this dev server."
      : liveBlocked;

  return (
    <article
      aria-labelledby={`${screen.slug}-title`}
      className="scroll-mt-24"
      id={screen.slug}
    >
      <header className="mb-3 flex flex-wrap items-start gap-x-4 gap-y-2">
        <span className="text-muted-foreground pt-0.5 font-mono text-xs tabular-nums">
          {String(number).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium" id={`${screen.slug}-title`}>
            {screen.title}
          </h3>
          <p className="text-muted-foreground mt-0.5 max-w-prose text-xs">
            {screen.description}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPills
            onChange={(next) => onStatusChange(screen.slug, next)}
            value={status}
          />
          {hasFixture && screen.livePath ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <SegmentedControl<ScreenSource>
                    ariaLabel={`${screen.title} source`}
                    onChange={setSource}
                    options={[
                      { label: "Sample", value: "fixture" },
                      {
                        disabled: Boolean(liveBlocked),
                        label: "Live",
                        value: "live",
                      },
                    ]}
                    value={activeSource}
                  />
                </span>
              </TooltipTrigger>
              {liveBlocked ? (
                <TooltipContent>{liveBlocked}</TooltipContent>
              ) : null}
            </Tooltip>
          ) : hasFixture ? (
            <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
              <IconFlask aria-hidden="true" className="size-3.5" />
              Sample data
            </span>
          ) : screen.requiresAuth ? (
            <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
              <IconLock aria-hidden="true" className="size-3.5" />
              Signed-in only
            </span>
          ) : null}
          <code className="bg-muted text-muted-foreground max-w-72 truncate rounded px-1.5 py-1 font-mono text-[11px]">
            {displayPath}
          </code>
          <Button
            aria-label={`Open ${screen.title} in a new tab`}
            asChild
            disabled={!src}
            size="icon-sm"
            variant="ghost"
          >
            <a
              aria-disabled={!src}
              href={src ?? undefined}
              rel="noreferrer"
              target="_blank"
            >
              <IconExternalLink aria-hidden="true" />
            </a>
          </Button>
          <Button
            aria-label={`Reload ${screen.title}`}
            disabled={!src}
            onClick={() => setPanelReload((key) => key + 1)}
            size="icon-sm"
            variant="ghost"
          >
            <IconRefresh aria-hidden="true" />
          </Button>
        </div>
      </header>

      <div className="bg-muted/40 overflow-x-auto rounded-xl border p-3">
        <div className="w-full min-w-0" ref={areaRef}>
          {scaledWidth === null || scaledHeight === null || scale === null ? (
            <div
              aria-hidden="true"
              className="bg-background w-full rounded-md border"
              style={{ height: artboardMinHeight / 2 }}
            />
          ) : (
            <div
              className="bg-background relative overflow-hidden rounded-md border shadow-sm"
              style={{ height: scaledHeight, width: scaledWidth }}
            >
              {src ? (
                <iframe
                  className="bg-background absolute top-0 left-0 border-0"
                  data-screen-frame=""
                  key={frameKey}
                  loading="lazy"
                  onLoad={handleLoad}
                  ref={frameRef}
                  src={src}
                  style={{
                    height,
                    transform: `scale(${scale})`,
                    transformOrigin: "top left",
                    width: artboardWidth,
                  }}
                  title={screen.title}
                />
              ) : (
                <div className="text-muted-foreground absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-sm">
                  <IconLock aria-hidden="true" className="size-5" />
                  <p>{unavailableReason ?? "Preview unavailable."}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
