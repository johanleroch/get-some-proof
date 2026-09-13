/**
 * Who to give the focus back to when a dialog closes.
 *
 * Pressing a button does not focus it on every browser: Safari moves the
 * focus to the nearest focusable ancestor instead, which in this app is the
 * scrollable page region. Reading `document.activeElement` alone would then
 * hand the focus back to that region rather than to the control that opened
 * the dialog, and the keyboard would land at the top of the page.
 *
 * Watching where the pointer goes down finds the control itself. The watch is
 * installed as soon as this module loads, because the press that opens a
 * dialog happens before anything of that dialog has mounted.
 */
const controlSelector =
  'button, [href], input, select, textarea, [role="button"], [role="menuitem"]';

let pointerControl: HTMLElement | null = null;

if (typeof document !== "undefined") {
  document.addEventListener(
    "pointerdown",
    (event) => {
      const target = event.target;
      pointerControl =
        target instanceof Element
          ? target.closest<HTMLElement>(controlSelector)
          : null;
    },
    true,
  );
}

/**
 * The element a closing dialog should hand the focus back to: the focused
 * control, the control the pointer last pressed, or whatever holds the focus
 * as a last resort. A focusable container that merely caught the focus on the
 * way past is never the answer.
 */
export function dialogOpener(): HTMLElement | null {
  const active =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  if (active?.matches(controlSelector)) return active;
  if (pointerControl?.isConnected) return pointerControl;
  return active &&
    active !== document.body &&
    active !== document.documentElement
    ? active
    : null;
}
