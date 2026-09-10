import type { KeyboardEvent } from "react";

/** Safari uses Option-Tab to include buttons. Radix ignores Alt-Tab when
 * looping, so its outside-focus guard otherwise returns to the last button. */
export function loopDialogOptionTab(event: KeyboardEvent<HTMLDivElement>) {
  if (
    event.defaultPrevented ||
    event.key !== "Tab" ||
    !event.altKey ||
    event.ctrlKey ||
    event.metaKey
  )
    return;
  const container = event.currentTarget;
  if (
    (event.target as HTMLElement).closest(
      '[role="dialog"], [role="alertdialog"]',
    ) !== container
  )
    return;
  const candidates = Array.from(
    container.querySelectorAll<HTMLElement>("*"),
  ).filter(
    (element) =>
      element.tabIndex >= 0 &&
      !element.matches(":disabled, input[type=hidden]") &&
      !element.closest("[inert]") &&
      element.checkVisibility({ visibilityProperty: true }),
  );
  const first = candidates[0];
  const last = candidates.at(-1);
  const target =
    event.shiftKey && document.activeElement === first
      ? last
      : !event.shiftKey && document.activeElement === last
        ? first
        : undefined;
  if (target) {
    event.preventDefault();
    target.focus();
  }
}
