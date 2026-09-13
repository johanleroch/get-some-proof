import { afterEach, describe, expect, it } from "vitest";

import { dialogOpener } from "@/lib/dialog-opener";

function press(element: Element) {
  element.dispatchEvent(new Event("pointerdown", { bubbles: true }));
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("dialogOpener", () => {
  it("keeps the focused control when the browser focused one", () => {
    document.body.innerHTML = `<button id="open">Open</button>`;
    const button = document.querySelector<HTMLButtonElement>("#open")!;
    press(button);
    button.focus();
    expect(dialogOpener()).toBe(button);
  });

  it("prefers the pressed control over a container that caught the focus", () => {
    // Safari focuses the nearest focusable ancestor, not the button itself.
    document.body.innerHTML = `<div id="region" tabindex="0"><button id="open">Open</button></div>`;
    const region = document.querySelector<HTMLElement>("#region")!;
    const button = document.querySelector<HTMLButtonElement>("#open")!;
    press(button);
    region.focus();
    expect(document.activeElement).toBe(region);
    expect(dialogOpener()).toBe(button);
  });

  it("reads through to the control when the press lands on its contents", () => {
    document.body.innerHTML = `<div id="region" tabindex="0"><button id="open"><span id="word">Open</span></button></div>`;
    const region = document.querySelector<HTMLElement>("#region")!;
    press(document.querySelector("#word")!);
    region.focus();
    expect(dialogOpener()).toBe(document.querySelector("#open"));
  });

  it("ignores a pressed control that has since left the page", () => {
    document.body.innerHTML = `<div id="region" tabindex="0"><button id="open">Open</button></div>`;
    const region = document.querySelector<HTMLElement>("#region")!;
    press(document.querySelector("#open")!);
    document.querySelector("#open")!.remove();
    region.focus();
    expect(dialogOpener()).toBe(region);
  });

  it("treats the document element as no opener either", () => {
    document.body.innerHTML = `<p>Nothing to press</p>`;
    press(document.querySelector("p")!);
    document.documentElement.focus();
    expect(dialogOpener()).toBeNull();
  });

  it("finds nothing worth restoring when the body holds the focus", () => {
    document.body.innerHTML = `<p>Nothing to press</p>`;
    press(document.querySelector("p")!);
    expect(dialogOpener()).toBeNull();
  });
});
