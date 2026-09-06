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
  await page.getByRole("button", { name: "Highlight selected text" }).click();
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

test("Owner highlights an immutable quote and saves the same words", async ({
  page,
}) => {
  await page.goto("/visual-evidence/rich-testimonial");
  await page
    .getByRole("button", { name: "Highlight a phrase", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  const editor = dialog.locator("[data-slate-editor]");
  await expect(editor).toHaveAttribute("contenteditable", "false");
  await editor.evaluate((element) => {
    const node = element.querySelector("[data-slate-string]")!.firstChild!;
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
  });
  await dialog.getByRole("button", { name: "Highlight selected text" }).click();
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator("blockquote")).toHaveText(
    "We saved five hours every week. Our customers noticed the difference immediately.",
  );
  await expect(page.locator("blockquote mark").first()).toContainText(
    "We saved",
  );
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
