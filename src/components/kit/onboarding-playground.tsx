"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconExternalLink,
  IconLayoutGrid,
  IconPalette,
  IconRefresh,
  IconRotateClockwise,
} from "@tabler/icons-react";

import {
  applyThemeToFrame,
  SegmentedControl,
  storedChoice,
  useStoredChoice,
} from "@/components/dev/dev-controls";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  initialJourneyState,
  isPlaygroundMessage,
  nextStep,
  type OnboardingJourneyAction,
  type OnboardingJourneyState,
  onboardingPlaygroundChannel,
  type OnboardingStepId,
  onboardingSteps,
  previousStep,
  reduceJourney,
  sampleAccount,
  sampleBrand,
  scenarioFor,
  stageUrl,
  stepById,
  stepIndex,
} from "@/lib/onboarding-journey";
import {
  type DeviceKey,
  deviceByKey,
  deviceKeys,
  devices,
} from "@/lib/screens-catalog";
import { themeChangeEvent } from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * The onboarding playground: the first journey listed on the left, the
 * current screen played on the right at a real device width, and the
 * failure scenarios to switch on beside it. The stage in the frame owns the
 * state and reports it; this page mirrors it so the list answers at once.
 */

const stageMaxHeight = 3200;
const zoomLevels = ["fit", "50", "75", "100"] as const;
type ZoomLevel = (typeof zoomLevels)[number];

const zoomStore = storedChoice<ZoomLevel>(
  "get-some-proof-onboarding-zoom",
  zoomLevels,
  "fit",
);
// The same key as /screens, so the device follows the designer between pages.
const deviceStore = storedChoice<DeviceKey>(
  "get-some-proof-screens-device",
  deviceKeys,
  "desktop",
);

/** Where "Open live" goes: the route itself, or the router that finds the Brand. */
function liveHref(id: OnboardingStepId) {
  const step = stepById(id);
  if (step.kind === "email") return null;
  return step.route.includes(":") ? "/dashboard" : step.route;
}

export function OnboardingPlayground({
  initialStep,
}: {
  initialStep: OnboardingStepId;
}) {
  const [state, setState] = useState<OnboardingJourneyState>(() =>
    reduceJourney(initialJourneyState, { step: initialStep, type: "go" }),
  );
  const zoom = useStoredChoice(zoomStore);
  const deviceKey = useStoredChoice(deviceStore);
  const device = deviceByKey(deviceKey);
  const [reloadKey, setReloadKey] = useState(0);
  const [areaWidth, setAreaWidth] = useState<number | null>(null);
  const [height, setHeight] = useState<number>(device.minHeight);
  const areaRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const bodyObserver = useRef<ResizeObserver | null>(null);
  const measureRef = useRef<(() => void) | null>(null);
  const minHeightRef = useRef(device.minHeight);
  const step = stepById(state.step);
  const index = stepIndex(state.step);

  // A new step, run, device or reload starts from the device height again
  // and grows to the content: `min-h-svh` screens fill whatever height the
  // frame has, so shrinking first is the only way to measure them.
  const heightKey = `${device.key}:${state.run}:${state.step}:${reloadKey}`;
  const [measuredKey, setMeasuredKey] = useState(heightKey);
  if (measuredKey !== heightKey) {
    setMeasuredKey(heightKey);
    setHeight(device.minHeight);
  }

  const send = useCallback((action: OnboardingJourneyAction) => {
    frameRef.current?.contentWindow?.postMessage(
      { action, channel: onboardingPlaygroundChannel, type: "action" },
      window.location.origin,
    );
  }, []);

  const dispatch = useCallback(
    (action: OnboardingJourneyAction) => {
      setState((current) => reduceJourney(current, action));
      send(action);
    },
    [send],
  );

  // The stage owns the truth; mirror whatever it reports.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== frameRef.current?.contentWindow
      ) {
        return;
      }
      if (!isPlaygroundMessage(event.data) || event.data.type !== "state") {
        return;
      }
      setState(event.data.state);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // The arrow keys walk the journey while nothing is being typed.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true]")) {
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        dispatch({ type: "advance" });
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        dispatch({ type: "back" });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dispatch]);

  // The address names the step, so a step can be shared or reloaded.
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("step", state.step);
    window.history.replaceState(null, "", url);
  }, [state.step]);

  useEffect(() => {
    const sync = () => {
      if (frameRef.current) applyThemeToFrame(frameRef.current);
    };
    window.addEventListener(themeChangeEvent, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(themeChangeEvent, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setAreaWidth(entry.contentRect.width);
    });
    observer.observe(area);
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => bodyObserver.current?.disconnect(), []);

  useEffect(() => {
    minHeightRef.current = device.minHeight;
  }, [device.minHeight]);

  // After the frame shrank for a new key, read the content's own height:
  // at once, since reading a scroll height lays the frame out even while no
  // frame is being painted, and again on the next paint for good measure.
  useEffect(() => {
    measureRef.current?.();
    const id = requestAnimationFrame(() => measureRef.current?.());
    return () => cancelAnimationFrame(id);
  }, [heightKey]);

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
        setHeight((current) =>
          Math.max(
            current,
            Math.min(stageMaxHeight, Math.max(minHeightRef.current, next)),
          ),
        );
      };
      measureRef.current = measure;
      measure();
      bodyObserver.current?.disconnect();
      bodyObserver.current = new ResizeObserver(measure);
      bodyObserver.current.observe(body);
    } catch {
      // Same-origin frames only; keep the device height otherwise.
    }
  }, []);

  // "Fit" scales the stage to the column (minus the frame's padding and
  // border); fixed zoom levels may overflow and scroll inside the frame.
  const frameInset = 26;
  const scaledWidth =
    zoom === "fit"
      ? areaWidth === null
        ? null
        : Math.floor(Math.min(areaWidth - frameInset, device.width))
      : Math.round((device.width * Number(zoom)) / 100);
  const scale = scaledWidth === null ? null : scaledWidth / device.width;
  const scaledHeight = scale === null ? null : Math.round(height * scale);
  const live = liveHref(state.step);
  const previous = previousStep(state.step);
  const next = nextStep(state.step);
  const scenario = scenarioFor(state, state.step);

  return (
    <div className="bg-background text-foreground min-h-svh">
      <header className="bg-background/85 sticky top-0 z-20 border-b backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-3 px-6 py-3">
          <div className="min-w-0 flex-1">
            <h1 className="type-subheading">Onboarding</h1>
            <p className="text-muted-foreground type-small">
              {onboardingSteps.length} steps from the account form to the first
              Overview, on sample data · {device.width}px stage · development
              only
            </p>
          </div>
          <SegmentedControl<DeviceKey>
            ariaLabel="Device"
            onChange={deviceStore.write}
            options={devices.map((preset) => ({
              label: preset.label,
              value: preset.key,
            }))}
            value={deviceKey}
          />
          <SegmentedControl
            ariaLabel="Zoom"
            onChange={zoomStore.write}
            options={zoomLevels.map((level) => ({
              label: level === "fit" ? "Fit" : `${level}%`,
              value: level,
            }))}
            value={zoom}
          />
          <Button
            aria-disabled={!live}
            asChild
            disabled={!live}
            size="sm"
            variant="outline"
          >
            <a href={live ?? undefined} rel="noreferrer" target="_blank">
              <IconExternalLink aria-hidden="true" />
              Open live
            </a>
          </Button>
          <Button
            onClick={() => setReloadKey((key) => key + 1)}
            size="sm"
            variant="outline"
          >
            <IconRefresh aria-hidden="true" />
            Reload
          </Button>
          <Button asChild size="sm" variant="outline">
            <a href="/kit">
              <IconPalette aria-hidden="true" />
              Kit
            </a>
          </Button>
          <Button asChild size="sm" variant="outline">
            <a href="/screens">
              <IconLayoutGrid aria-hidden="true" />
              Screens
            </a>
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto flex max-w-[1600px] flex-col gap-8 px-6 py-8 lg:flex-row">
        <aside
          aria-label="Journey controls"
          className="w-full shrink-0 space-y-8 lg:sticky lg:top-[81px] lg:max-h-[calc(100svh-97px)] lg:w-72 lg:self-start lg:overflow-y-auto"
        >
          <section aria-labelledby="journey-title" className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2
                className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase"
                id="journey-title"
              >
                Journey
              </h2>
              <span className="text-muted-foreground text-xs tabular-nums">
                {index + 1} / {onboardingSteps.length}
              </span>
            </div>
            <ol className="space-y-0.5">
              {onboardingSteps.map((candidate, candidateIndex) => {
                const status =
                  candidateIndex < index
                    ? "done"
                    : candidateIndex === index
                      ? "current"
                      : "upcoming";
                return (
                  <li key={candidate.id}>
                    <button
                      aria-current={status === "current" ? "step" : undefined}
                      className={cn(
                        "focus-visible:ring-ring relative flex w-full cursor-pointer items-start gap-3 rounded-md px-2.5 py-2 text-left transition-colors duration-150 outline-none focus-visible:ring-[3px]",
                        status === "current"
                          ? "bg-brand-soft text-ink before:bg-brand before:absolute before:top-2 before:bottom-2 before:left-0 before:w-[3px] before:rounded-full"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      )}
                      onClick={() =>
                        dispatch({ step: candidate.id, type: "go" })
                      }
                      type="button"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-0.5 grid size-5 shrink-0 place-items-center font-mono text-[11px] tabular-nums"
                      >
                        {status === "done" ? (
                          <IconCheck className="size-3.5" />
                        ) : (
                          String(candidateIndex + 1).padStart(2, "0")
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "type-ui block",
                            status === "current"
                              ? "font-semibold"
                              : "font-medium",
                          )}
                        >
                          {candidate.title}
                        </span>
                        <span className="text-muted-foreground block text-xs">
                          {candidate.kind === "interstitial"
                            ? "Moves on by itself when played"
                            : candidate.kind === "email"
                              ? "In the inbox"
                              : candidate.route}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => dispatch({ type: "restart" })}
                size="sm"
                variant="outline"
              >
                <IconRotateClockwise aria-hidden="true" />
                Restart
              </Button>
              <Button
                aria-label="Previous step"
                disabled={!previous}
                onClick={() => dispatch({ type: "back" })}
                size="icon-sm"
                variant="outline"
              >
                <IconChevronLeft aria-hidden="true" />
              </Button>
              <Button
                className="flex-1"
                disabled={!next}
                onClick={() => dispatch({ type: "advance" })}
                size="sm"
              >
                Next
                <IconChevronRight aria-hidden="true" />
              </Button>
            </div>
          </section>

          {step.scenarios.length > 0 ? (
            <section aria-labelledby="scenario-title" className="space-y-3">
              <h2
                className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase"
                id="scenario-title"
              >
                Scenario · {step.title}
              </h2>
              <div
                aria-label={`${step.title} scenario`}
                className="space-y-0.5"
                role="radiogroup"
              >
                {step.scenarios.map((candidate) => {
                  const active = candidate.id === scenario;
                  return (
                    <button
                      aria-checked={active}
                      className={cn(
                        "focus-visible:ring-ring flex w-full cursor-pointer items-start gap-2.5 rounded-md border px-2.5 py-2 text-left transition-colors duration-150 outline-none focus-visible:ring-[3px]",
                        active
                          ? "bg-card border-border text-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground border-transparent",
                      )}
                      key={candidate.id}
                      onClick={() =>
                        dispatch({
                          scenario: candidate.id,
                          step: step.id,
                          type: "scenario",
                        })
                      }
                      role="radio"
                      type="button"
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "mt-1.5 size-2 shrink-0 rounded-full border",
                          active ? "bg-brand border-brand" : "border-line-2",
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="type-ui block font-medium">
                          {candidate.label}
                        </span>
                        <span className="text-muted-foreground block text-xs">
                          {candidate.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section aria-labelledby="playing-title" className="space-y-3">
            <h2
              className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase"
              id="playing-title"
            >
              Playing as
            </h2>
            <dl className="space-y-1.5 text-xs">
              <div className="flex gap-3">
                <dt className="text-muted-foreground w-14 shrink-0">Account</dt>
                <dd className="min-w-0 flex-1 truncate">
                  {state.account
                    ? `${state.account.name} · ${state.account.email}`
                    : `${sampleAccount.name} · sample until you sign up`}
                </dd>
              </div>
              <div className="flex gap-3">
                <dt className="text-muted-foreground w-14 shrink-0">Brand</dt>
                <dd className="min-w-0 flex-1 truncate">
                  {state.brand
                    ? `${state.brand.name} · /c/${state.brand.publicSlug}`
                    : `${sampleBrand.name} · sample until you create one`}
                </dd>
              </div>
            </dl>
          </section>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-start gap-x-4 gap-y-2">
            <div className="min-w-0 flex-1">
              <h2 className="type-ui font-semibold">{step.title}</h2>
              <p className="text-muted-foreground mt-0.5 max-w-prose text-xs">
                {step.description}
              </p>
            </div>
            <code className="bg-muted text-muted-foreground max-w-72 truncate rounded px-1.5 py-1 font-mono text-[11px]">
              {step.route}
            </code>
            {step.source !== step.route ? (
              <code className="bg-muted text-muted-foreground max-w-96 truncate rounded px-1.5 py-1 font-mono text-[11px]">
                {step.source}
              </code>
            ) : null}
          </div>

          <div className="w-full min-w-0" ref={areaRef}>
            <div
              className={cn(
                "bg-muted/40 overflow-x-auto rounded-xl border p-3",
                scaledWidth === null ? "w-full" : "w-fit max-w-full",
              )}
            >
              {scaledWidth === null ||
              scaledHeight === null ||
              scale === null ? (
                <div
                  aria-hidden="true"
                  className="bg-background w-full rounded-md border"
                  style={{ height: device.minHeight / 2 }}
                />
              ) : (
                <div
                  className="bg-background relative overflow-hidden rounded-md border shadow-sm"
                  style={{ height: scaledHeight, width: scaledWidth }}
                >
                  <iframe
                    className="bg-background absolute top-0 left-0 border-0"
                    key={reloadKey}
                    onLoad={handleLoad}
                    ref={frameRef}
                    src={stageUrl(initialStep)}
                    style={{
                      height,
                      transform: `scale(${scale})`,
                      transformOrigin: "top left",
                      width: device.width,
                    }}
                    title="Onboarding stage"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
