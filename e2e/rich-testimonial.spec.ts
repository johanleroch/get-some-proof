import { expect, test } from "@playwright/test";

test("writes paragraphs, highlights a phrase, and adds/removes images", async ({
  page,
}) => {
  await page.goto("/visual-evidence/rich-testimonial");
  const editor = page.getByRole("textbox", { name: "Your testimonial" });
  await editor.click();
  await editor.press("ControlOrMeta+A");
  await editor.press("Backspace");
  await editor.pressSequentially("We saved five hours every week.");
  await editor.press("Enter");
  await editor.pressSequentially("Our customers noticed.");
  await expect(page.locator("blockquote")).toHaveText(
    "We saved five hours every week.Our customers noticed.",
  );
  await editor.evaluate((element) => {
    const node = element.querySelector("[data-slate-string]")!.firstChild!;
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(node, 9);
    range.setEnd(node, 19);
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
  });
  await page.getByRole("button", { name: "Highlight", exact: true }).click();
  await expect(page.locator("blockquote mark")).toHaveText("five hours");
  await page.getByLabel("Attach testimonial images").setInputFiles({
    name: "proof.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZuoAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(page.getByRole("img", { name: "proof.png" })).toBeVisible();
  await page.getByRole("button", { name: "Remove proof.png" }).click();
  await expect(page.getByRole("img", { name: "proof.png" })).toHaveCount(0);
});

test("Owner marks a phrase, can unmark it, and never changes the words", async ({
  page,
}) => {
  const quote =
    "We saved five hours every week. Our customers noticed the difference immediately.";
  await page.goto("/visual-evidence/rich-testimonial");
  await page
    .getByRole("button", { name: "Highlight a phrase", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  // The rule the product enforces is said out loud, not only in the server.
  await expect(dialog).toContainText("they stay as written");
  const editor = dialog.locator("#highlight-testimonial");
  // The words are immutable by construction: nothing an Owner does here can
  // rewrite what their customer wrote (docs/product-scope.md).
  await expect(editor).toHaveAttribute("contenteditable", "false");

  // With nothing selected the toolbar instructs rather than showing a dead button.
  await expect(dialog).toContainText("Select a few words in the quote below.");
  await expect(
    dialog.getByRole("button", { name: /^(Highlight|Remove highlight)$/ }),
  ).toHaveCount(0);

  await editor.dblclick({ position: { x: 60, y: 16 } });
  const toggle = dialog.getByRole("button", {
    name: /^(Highlight|Remove highlight)$/,
  });
  await expect(toggle).toHaveText("Highlight");
  await toggle.click();

  // The same words now offer the opposite act: that is the undo.
  await editor.dblclick({ position: { x: 60, y: 16 } });
  await expect(toggle).toHaveText("Remove highlight");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await toggle.click();
  await expect(toggle).toHaveText("Highlight");
  await toggle.click();

  // Typing and deleting must leave the customer's words untouched. The click
  // is pinned to the first line: the highlight pill follows the selection and
  // would otherwise take a click aimed at the middle of the quote.
  await editor.click({ position: { x: 60, y: 16 } });
  await page.keyboard.type("XXXX");
  await page.keyboard.press("Backspace");
  await expect(editor).toHaveText(quote);

  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator("blockquote").first()).toHaveText(quote);
  await expect(page.locator("blockquote mark").first()).toContainText("We");
});

test("preserves pasted paragraphs and strips pasted HTML formatting", async ({
  page,
}) => {
  await page.goto("/visual-evidence/rich-testimonial");
  const editor = page.getByRole("textbox", { name: "Your testimonial" });
  await editor.click();
  await editor.press("ControlOrMeta+A");
  await editor.press("Backspace");
  await editor.evaluate((element) => {
    const data = new DataTransfer();
    data.setData("text/plain", "First paragraph.\nSecond paragraph.");
    data.setData("text/html", "<h1>Unexpected HTML</h1>");
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: data });
    element.dispatchEvent(event);
  });
  await expect(page.locator("blockquote")).toHaveText(
    "First paragraph.Second paragraph.",
  );
  await expect(page.locator("blockquote br")).toHaveCount(1);
  await expect(editor.locator("h1")).toHaveCount(0);
});

test("keeps the editor and following controls still as text grows", async ({
  page,
}) => {
  await page.goto("/visual-evidence/collection-form-write");
  const editor = page.getByRole("textbox", { name: "Your testimonial" });
  const initialHeight = (await editor.boundingBox())!.height;
  const continueButton = page.getByRole("button", {
    name: "Continue",
    exact: true,
  });
  const initialTop = await continueButton.evaluate(
    (el) => el.getBoundingClientRect().top + window.scrollY,
  );
  await editor.click();
  await editor.press("ControlOrMeta+End");
  for (let line = 0; line < 12; line++) {
    await editor.press("Enter");
    await editor.pressSequentially("More useful feedback.", { delay: 10 });
  }
  expect((await editor.boundingBox())!.height).toBe(initialHeight);
  expect(
    await continueButton.evaluate(
      (el) => el.getBoundingClientRect().top + window.scrollY,
    ),
  ).toBe(initialTop);
  const scroll = await editor.evaluate((el) => ({
    height: el.clientHeight,
    content: el.scrollHeight,
  }));
  expect(scroll.content).toBeGreaterThan(scroll.height);
  await editor.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  expect(await editor.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  // The toolbar keeps its place while the text grows. With nothing selected
  // it instructs instead of showing a button that cannot be pressed.
  await expect(
    page.getByText("Select a few words in the quote below."),
  ).toBeVisible();
});
