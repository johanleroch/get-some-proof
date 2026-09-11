"use client";
import {
  useEffect,
  useReducer,
  useRef,
  type SetStateAction,
  type ComponentProps,
} from "react";
import { convexErrorMessage } from "@/lib/convex-error-message";
import type {
  TestimonialInboxView,
  InboxTestimonial,
} from "./testimonial-inbox";
import {
  collectInboxSelection,
  canPublish,
  resultLabels,
  type BulkInboxAction,
  type Failure,
  type InboxPage,
} from "./inbox-bulk";
export type BulkInboxProps = Omit<
  ComponentProps<typeof TestimonialInboxView>,
  "selection"
> & {
  totalCount: number;
  hasMore: boolean;
  loadPage: (cursor: string | null) => Promise<InboxPage>;
  perform: (
    item: InboxTestimonial,
    action: BulkInboxAction,
    attested: boolean,
  ) => Promise<void>;
};
type BulkState = {
  selected: Map<string, InboxTestimonial>;
  phase: "idle" | "selecting" | "running";
  confirmation: BulkInboxAction | null;
  attested: boolean;
  outcome: string;
  failures: Failure[];
  progress: { done: number; total: number };
};
type Update = Partial<BulkState> | ((state: BulkState) => Partial<BulkState>);
function reduce(state: BulkState, update: Update): BulkState {
  return {
    ...state,
    ...(typeof update === "function" ? update(state) : update),
  };
}

export function useInboxSelection({
  totalCount,
  loadPage,
  perform,
  ...view
}: BulkInboxProps) {
  const [state, update] = useReducer(reduce, {
    selected: new Map<string, InboxTestimonial>(),
    phase: "idle",
    confirmation: null,
    attested: false,
    outcome: "",
    failures: [],
    progress: { done: 0, total: 0 },
  });
  const {
    selected,
    phase,
    confirmation,
    attested,
    outcome,
    failures,
    progress,
  } = state;
  const setSelected = (value: SetStateAction<BulkState["selected"]>) =>
    update((state) => ({
      selected: typeof value === "function" ? value(state.selected) : value,
    }));
  const setPhase = (phase: BulkState["phase"]) => update({ phase });
  const setConfirmation = (confirmation: BulkState["confirmation"]) =>
    update({ confirmation });
  const setAttested = (attested: BulkState["attested"]) => update({ attested });
  const setOutcome = (outcome: BulkState["outcome"]) => update({ outcome });
  const setFailures = (failures: BulkState["failures"]) => update({ failures });
  const setProgress = (progress: BulkState["progress"]) => update({ progress });
  const operation = useRef(0);
  const locked = useRef(false);
  const toolbar = useRef<HTMLDivElement>(null);
  useEffect(
    () => () => {
      operation.current++;
    },
    [],
  );
  // Refresh visible selected records (e.g. a video finishes processing).
  const visible = new Map(
    view.testimonials.map((item) => [String(item.testimonialId), item]),
  );
  const items = [...selected].map(([id, item]) => visible.get(id) ?? item);
  const ready = items.filter(canPublish);
  const imports = ready.filter((item) => item.requiresImportAttestation).length;
  const blocked = phase !== "idle" || Boolean(view.actionsDisabled);
  const displayedSelected = view.testimonials.filter((item) =>
    selected.has(item.testimonialId),
  ).length;
  const checked: boolean | "indeterminate" =
    displayedSelected === 0
      ? false
      : displayedSelected === view.testimonials.length
        ? true
        : "indeterminate";
  const countLabel =
    totalCount > 500
      ? "all testimonials in this tab"
      : `all ${totalCount} testimonials in this tab`;

  function clear() {
    operation.current++;
    locked.current = false;
    setSelected(new Map());
    setPhase("idle");
    setFailures([]);
    setOutcome("");
  }
  function toggle(item: InboxTestimonial) {
    setSelected((previous) => {
      const next = new Map(previous);
      if (next.has(item.testimonialId)) next.delete(item.testimonialId);
      else next.set(item.testimonialId, item);
      return next;
    });
    setOutcome("");
    setFailures([]);
  }
  async function selectAll(onlySelected = false) {
    if (locked.current || blocked) return;
    locked.current = true;
    const token = ++operation.current;
    update({ phase: "selecting", outcome: "", failures: [] });
    try {
      const all = await collectInboxSelection(
        loadPage,
        () => operation.current !== token,
      );
      if (all) {
        setSelected((previous) =>
          onlySelected
            ? new Map(
                [...previous].map(([id, item]) => [id, all.get(id) ?? item]),
              )
            : all,
        );
        if (onlySelected) setOutcome("Selection refreshed.");
      }
    } catch (error) {
      if (operation.current === token)
        setOutcome(
          convexErrorMessage(
            error,
            "Could not select every testimonial. Your previous selection is unchanged.",
          ),
        );
    } finally {
      if (operation.current === token) {
        locked.current = false;
        setPhase("idle");
      }
    }
  }
  async function run(action: BulkInboxAction) {
    if (locked.current || blocked) return;
    locked.current = true;
    const token = ++operation.current;
    const batch = action === "publish" ? ready : items;
    const accepted = attested;
    update({
      confirmation: null,
      phase: "running",
      outcome: "",
      failures: [],
      progress: { done: 0, total: batch.length },
    });
    let successes = 0;
    const errors: Failure[] = [];
    for (const item of batch) {
      // Leaving this scope stops the unsent remainder, never acts in the next project.
      if (operation.current !== token) return;
      try {
        await perform(item, action, accepted);
        successes++;
        if (operation.current === token)
          setSelected((previous) => {
            const next = new Map(previous);
            next.delete(item.testimonialId);
            return next;
          });
      } catch (error) {
        errors.push({
          item,
          message: convexErrorMessage(
            error,
            "Could not update this testimonial. Please try again.",
          ),
        });
      }
      if (operation.current === token)
        setProgress({ done: successes + errors.length, total: batch.length });
    }
    if (operation.current !== token) return;
    const skipped = items.length - batch.length;
    setOutcome(
      `${successes} ${resultLabels[action]}${errors.length ? ` · ${errors.length} failed` : ""}${skipped ? ` · ${skipped} videos not ready` : ""}.`,
    );
    setFailures(errors);
    setPhase("idle");
    locked.current = false;
    toolbar.current?.focus();
  }
  function request(action: BulkInboxAction) {
    setAttested(false);
    if (action === "delete" || (action === "publish" && imports > 0))
      setConfirmation(action);
    else void run(action);
  }
  return {
    selected,
    setSelected,
    phase,
    confirmation,
    setConfirmation,
    attested,
    setAttested,
    outcome,
    failures,
    setFailures,
    setOutcome,
    progress,
    toolbar,
    items,
    ready,
    imports,
    blocked,
    checked,
    countLabel,
    clear,
    selectAll,
    run,
    request,
    toggle,
  };
}
