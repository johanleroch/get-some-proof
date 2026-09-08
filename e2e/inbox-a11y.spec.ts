import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * The redesigned Inbox under a real browser: axe on every category and
 * dialog in both colour schemes, then the keyboard alone — reading order,
 * the tab list's arrows, the "..." menu, the two dialogs' focus traps, the
 * names icon-only controls carry, the status Badge and the blob loader in
 * the accessibility tree, and the focus ring on the video still.
 *
 * The fixtures are static views: Publish, Archive, Unpublish, Not Spam, the
 * menu items and Save/Cancel/Delete call no-op callbacks there, so this spec
 * only checks that they are reachable and named, never that they act.
 */

const wcagTags = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22a",
  "wcag22aa",
];

type Scheme = "light" | "dark";
const schemes: Scheme[] = ["light", "dark"];

const inboxPath = "/visual-evidence/testimonial-inbox";
const detailsPath = "/visual-evidence/testimonial-inbox-details";
const deletePath = "/visual-evidence/testimonial-delete";

async function expectNoWcagViolations(page: Page, context: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(wcagTags)
    .analyze();
  expect(
    violations.map(({ help, id, impact, nodes }) => ({
      context,
      help,
      id,
      impact,
      nodes: nodes.map((node) => ({
        failureSummary: node.failureSummary,
        html: node.html,
        target: node.target.join(" "),
      })),
    })),
  ).toEqual([]);
}

/**
 * The theme script honours prefers-color-scheme when nothing is stored, so
 * emulating the media query is enough to get the `.dark` root class.
 */
async function openInbox(page: Page, path: string, scheme: Scheme = "light") {
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
  await page.goto(path);
  // CSS locators on purpose: two fixtures open a modal dialog at load, which
  // aria-hides the page behind it and takes it out of the role tree.
  await expect(page.locator("h1", { hasText: "Inbox" })).toBeVisible();
  await expect(
    page.locator('[role="tablist"][aria-label="Testimonial categories"]'),
  ).toBeVisible();
  const html = page.locator("html");
  if (scheme === "dark") await expect(html).toHaveClass(/dark/);
  else await expect(html).not.toHaveClass(/dark/);
  // The tabs and menus answer the keyboard only once React has hydrated.
  await page.waitForFunction(() => {
    const tab = document.querySelector('[role="tab"]');
    return (
      tab !== null &&
      Object.keys(tab).some((key) => key.startsWith("__reactFiber"))
    );
  });
}

/** The dialog titles use the typographic apostrophe (`&rsquo;`). */
const previewDialogName = "Remy Jupille’s video";
const detailsDialogName = "Details on Alice Martin’s card";

function tab(page: Page, label: string) {
  return page.getByRole("tab", { name: new RegExp(`^${label}`) });
}

/** The focused element as a reader hears it. */
async function focused(page: Page) {
  return page.evaluate(() => {
    const element = document.activeElement;
    if (!element || element === document.body) {
      return { disabled: false, inDialog: false, name: "", role: "body" };
    }
    const label = element.getAttribute("aria-label");
    const labelledBy = element.getAttribute("aria-labelledby");
    const name =
      label ??
      (labelledBy
        ? labelledBy
            .split(" ")
            .map((id) => document.getElementById(id)?.textContent ?? "")
            .join(" ")
        : (element.textContent ?? ""));
    return {
      disabled: (element as HTMLButtonElement).disabled === true,
      inDialog: Boolean(
        element.closest('[role="dialog"], [role="alertdialog"]'),
      ),
      name: name.replace(/\s+/g, " ").trim(),
      role: element.getAttribute("role") ?? element.tagName.toLowerCase(),
    };
  });
}

/** Every stop Tab makes from `start` until focus leaves the document. */
async function tabSequenceFrom(page: Page, start: Locator, max = 40) {
  await start.focus();
  const stops: string[] = [];
  const first = await focused(page);
  stops.push(`${first.role}: ${first.name}`);
  for (let index = 0; index < max; index++) {
    await page.keyboard.press("Tab");
    const stop = await focused(page);
    if (stop.role === "body") break;
    const key = `${stop.role}: ${stop.name}`;
    if (key === stops[0]) break;
    // Firefox leaves focus on the last control instead of handing it to the
    // browser chrome, so the sequence ends when Tab no longer moves.
    if (key === stops[stops.length - 1]) break;
    expect(stop.disabled, `Tab landed on a disabled control: ${key}`).toBe(
      false,
    );
    stops.push(key);
  }
  return stops;
}

/** Development-only stops: the designer quick access and Next's dev overlay. */
const devOnlyStops = ["button: Designer quick access", "nextjs-portal: "];

function withoutDevTools(stops: string[]) {
  return stops.filter((stop) => !devOnlyStops.includes(stop));
}

async function menuItemNames(page: Page) {
  return page.getByRole("menuitem").allInnerTexts();
}

test.describe("axe, light and dark", () => {
  for (const scheme of schemes) {
    test(`${scheme}: every category of ${inboxPath} has no WCAG 2.2 A/AA violation`, async ({
      page,
    }) => {
      await openInbox(page, inboxPath, scheme);
      await expect(page.getByRole("button", { name: "Archive" })).toHaveCount(
        3,
      );
      await expectNoWcagViolations(page, `${scheme} Pending`);

      await tab(page, "Published").click();
      await expect(page.getByRole("button", { name: "Unpublish" })).toHaveCount(
        2,
      );
      await expectNoWcagViolations(page, `${scheme} Published`);

      await tab(page, "Archived").click();
      await expect(
        page.getByRole("heading", { name: "Nothing Archived" }),
      ).toBeVisible();
      await expectNoWcagViolations(page, `${scheme} Archived`);

      await tab(page, "Spam").click();
      await expect(
        page.getByRole("button", { name: "Not Spam" }),
      ).toBeVisible();
      await expectNoWcagViolations(page, `${scheme} Spam`);
    });

    test(`${scheme}: the preview dialog and the open menu have no WCAG 2.2 A/AA violation`, async ({
      page,
    }) => {
      await openInbox(page, inboxPath, scheme);
      await page
        .getByRole("button", {
          name: "More actions for Alice Martin's Testimonial",
        })
        .click();
      await expect(page.getByRole("menu")).toBeVisible();
      // The menu is a Radix modal menu: while it is open the rest of the page
      // is aria-hidden with its focusable rows still in the DOM, which axe
      // reports as aria-hidden-focus (it accepts the same pattern only behind
      // a role=dialog). The keyboard test below proves Tab cannot leave the
      // menu; the rule is set aside here so the other rules still run.
      const { violations } = await new AxeBuilder({ page })
        .withTags(wcagTags)
        .disableRules(["aria-hidden-focus"])
        .analyze();
      expect(
        violations.map(({ id, nodes }) => ({ id, nodes: nodes.length })),
      ).toEqual([]);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("menu")).toHaveCount(0);

      await page
        .getByRole("button", { name: "Preview Remy Jupille's video" })
        .click();
      await expect(
        page.getByRole("dialog", { name: previewDialogName }),
      ).toBeVisible();
      await expectNoWcagViolations(page, `${scheme} preview dialog`);
    });

    test(`${scheme}: ${detailsPath} has no WCAG 2.2 A/AA violation`, async ({
      page,
    }) => {
      await openInbox(page, detailsPath, scheme);
      await expect(
        page.getByRole("dialog", { name: detailsDialogName }),
      ).toBeVisible();
      await expectNoWcagViolations(page, `${scheme} details dialog`);
    });

    test(`${scheme}: ${deletePath} has no WCAG 2.2 A/AA violation`, async ({
      page,
    }) => {
      await openInbox(page, deletePath, scheme);
      await expect(page.getByRole("alertdialog")).toBeVisible();
      await expectNoWcagViolations(page, `${scheme} delete dialog`);
    });
  }
});

test.describe("keyboard", () => {
  test("Tab reaches every control of Pending in reading order", async ({
    page,
  }) => {
    await openInbox(page, inboxPath);
    const stops = await tabSequenceFrom(
      page,
      page.getByRole("link", { name: "Open Public Wall" }),
    );
    expect(withoutDevTools(stops)).toEqual([
      "a: Open Public Wall",
      "tab: Pending 3",
      "tabpanel: Pending 3",
      // Nora Lewis: video processing, so Publish is disabled and skipped.
      "button: Archive",
      "button: More actions for Nora Lewis's Testimonial",
      // Alice Martin: text.
      "button: Publish",
      "button: Archive",
      "button: More actions for Alice Martin's Testimonial",
      // Remy Jupille: Ready video, the still comes first.
      "button: Preview Remy Jupille's video",
      "button: Publish",
      "button: Archive",
      "button: More actions for Remy Jupille's Testimonial",
    ]);
    await expect(
      page
        .getByTestId("inbox-testimonial-fixture-processing-video")
        .getByRole("button", { name: "Publish" }),
    ).toBeDisabled();
  });

  test("Tab reaches every control of Published, skipping the disabled arrows", async ({
    page,
  }) => {
    await openInbox(page, inboxPath);
    await tab(page, "Published").click();
    await expect(page.getByRole("button", { name: "Unpublish" })).toHaveCount(
      2,
    );
    await expect(
      page.getByRole("button", { name: "Move Remy Jupille up" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Move Alice Martin down" }),
    ).toBeDisabled();
    const stops = await tabSequenceFrom(
      page,
      page.getByRole("link", { name: "Open Public Wall" }),
    );
    expect(withoutDevTools(stops)).toEqual([
      "a: Open Public Wall",
      "tab: Published 2",
      "tabpanel: Published 2",
      "button: Preview Remy Jupille's video",
      "button: Move Remy Jupille down",
      "button: Unpublish",
      "button: More actions for Remy Jupille's Testimonial",
      "button: Move Alice Martin up",
      "button: Unpublish",
      "button: More actions for Alice Martin's Testimonial",
    ]);
  });

  test("Tab reaches every control of Spam and of an empty category", async ({
    page,
  }) => {
    await openInbox(page, inboxPath);
    await tab(page, "Spam").click();
    await expect(page.getByRole("button", { name: "Not Spam" })).toBeVisible();
    expect(
      withoutDevTools(
        await tabSequenceFrom(
          page,
          page.getByRole("link", { name: "Open Public Wall" }),
        ),
      ),
    ).toEqual([
      "a: Open Public Wall",
      "tab: Spam 1",
      "tabpanel: Spam 1",
      "button: Not Spam",
      "button: More actions for Suspicious Submission's Testimonial",
    ]);

    await tab(page, "Archived").click();
    await expect(
      page.getByRole("heading", { name: "Nothing Archived" }),
    ).toBeVisible();
    expect(
      withoutDevTools(
        await tabSequenceFrom(
          page,
          page.getByRole("link", { name: "Open Public Wall" }),
        ),
      ),
    ).toEqual([
      "a: Open Public Wall",
      "tab: Archived",
      "tabpanel: Archived",
      "button: Go to Pending",
    ]);
    await page.getByRole("button", { name: "Go to Pending" }).focus();
    await page.keyboard.press("Enter");
    await expect(tab(page, "Pending")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("button", { name: "Archive" })).toHaveCount(3);
  });

  test("the tab list moves with ArrowRight and ArrowLeft and the panel follows", async ({
    page,
  }) => {
    await openInbox(page, inboxPath);
    const pending = tab(page, "Pending");
    await pending.focus();
    await expect(pending).toHaveAttribute("aria-selected", "true");

    await page.keyboard.press("ArrowRight");
    await expect(tab(page, "Published")).toBeFocused();
    await expect(tab(page, "Published")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(
      page.getByText("Visitors see your Public Wall in this order"),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Unpublish" })).toHaveCount(
      2,
    );

    await page.keyboard.press("ArrowRight");
    await expect(tab(page, "Archived")).toBeFocused();
    await expect(
      page.getByRole("heading", { name: "Nothing Archived" }),
    ).toBeVisible();

    await page.keyboard.press("ArrowRight");
    await expect(tab(page, "Spam")).toBeFocused();
    await expect(page.getByRole("button", { name: "Not Spam" })).toBeVisible();

    // One press at a time, as a hand does: each press is asserted before the
    // next, since the panel re-renders under every activation.
    await page.keyboard.press("ArrowLeft");
    await expect(tab(page, "Archived")).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(tab(page, "Published")).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(pending).toBeFocused();
    await expect(pending).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("button", { name: "Archive" })).toHaveCount(3);
    await page.keyboard.press("End");
    await expect(tab(page, "Spam")).toBeFocused();
    await page.keyboard.press("Home");
    await expect(pending).toBeFocused();

    // Only the active tab is a Tab stop; the others are reached by arrows.
    const tabIndexes = await page
      .getByRole("tab")
      .evaluateAll((tabs) => tabs.map((element) => element.tabIndex));
    expect(tabIndexes).toEqual([0, -1, -1, -1]);
    await expect(page.getByRole("tabpanel")).toHaveCount(1);
  });

  test("the menu opens with Enter, walks with ArrowDown, closes with Escape and returns focus", async ({
    page,
  }) => {
    await openInbox(page, inboxPath);
    // A CSS locator: the modal menu hides its own trigger from the
    // accessibility tree while it is open, so getByRole cannot see it then.
    const trigger = page.locator(
      'button[aria-label="More actions for Alice Martin\'s Testimonial"]',
    );
    await trigger.focus();
    await page.keyboard.press("Enter");
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(await menuItemNames(page)).toEqual([
      "Highlight a phrase",
      "Mark as Spam",
      "Delete permanently",
    ]);
    // Focus lands inside the menu: on its first item, or on the menu itself
    // when a slow first paint mounts the items after the roving focus group
    // has looked for one, in which case ArrowDown reaches the first item.
    await expect
      .poll(async () => (await focused(page)).role)
      .toMatch(/^menu(item)?$/);
    if ((await focused(page)).role === "menu") {
      await page.keyboard.press("ArrowDown");
    }
    await expect(
      page.getByRole("menuitem", { name: "Highlight a phrase" }),
    ).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(
      page.getByRole("menuitem", { name: "Mark as Spam" }),
    ).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(
      page.getByRole("menuitem", { name: "Delete permanently" }),
    ).toBeFocused();
    // Tab must not escape the menu into the page.
    await page.keyboard.press("Tab");
    expect((await focused(page)).role).toBe("menuitem");
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  test("the menu offers the tools each Testimonial state allows", async ({
    page,
  }) => {
    await openInbox(page, inboxPath);
    const expectMenu = async (owner: string, items: string[]) => {
      const trigger = page.getByRole("button", {
        name: `More actions for ${owner}'s Testimonial`,
      });
      await trigger.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("menu")).toBeVisible();
      expect(await menuItemNames(page)).toEqual(items);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("menu")).toHaveCount(0);
    };
    // Pending: a processing video has no tool yet; a Ready video has its still.
    await expectMenu("Nora Lewis", ["Mark as Spam", "Delete permanently"]);
    await expectMenu("Remy Jupille", [
      "Change thumbnail",
      "Mark as Spam",
      "Delete permanently",
    ]);
    await tab(page, "Published").click();
    await expectMenu("Alice Martin", [
      "Highlight a phrase",
      "Show or hide details",
      "Mark as Spam",
      "Delete permanently",
    ]);
    await tab(page, "Spam").click();
    await expectMenu("Suspicious Submission", ["Delete permanently"]);
  });

  test("the preview dialog traps focus, closes with Escape and returns focus to the still", async ({
    page,
  }) => {
    await openInbox(page, inboxPath);
    const still = page.getByRole("button", {
      name: "Preview Remy Jupille's video",
    });
    await still.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: previewDialogName });
    await expect(dialog).toBeVisible();
    expect((await focused(page)).inDialog).toBe(true);
    const play = dialog.getByRole("button", {
      name: "Play Remy Jupille's testimonial",
    });
    await expect(play).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Close" })).toBeVisible();

    const reached = new Set<string>();
    for (let index = 0; index < 6; index++) {
      await page.keyboard.press("Tab");
      const stop = await focused(page);
      expect(
        stop.inDialog,
        `Tab left the dialog to ${stop.role}: ${stop.name}`,
      ).toBe(true);
      reached.add(`${stop.role}: ${stop.name}`);
    }
    expect([...reached]).toEqual(
      expect.arrayContaining([
        "button: Play Remy Jupille's testimonial",
        "button: Close",
      ]),
    );
    for (let index = 0; index < 3; index++) {
      await page.keyboard.press("Shift+Tab");
      expect((await focused(page)).inDialog).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);

    // The X button and the overlay close it too.
    await still.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toHaveCount(0);
    await still.click();
    await expect(dialog).toBeVisible();
    await page.mouse.click(8, 8);
    await expect(dialog).toHaveCount(0);
  });

  test("closing the preview dialog returns focus to the still that opened it", async ({
    page,
  }) => {
    await openInbox(page, inboxPath);
    const still = page.getByRole("button", {
      name: "Preview Remy Jupille's video",
    });
    await still.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: previewDialogName });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    const after = await focused(page);
    test.info().annotations.push({
      description: `after Escape, focus is on ${after.role}: "${after.name}"`,
      type: "focus-after-dialog-close",
    });
    await expect(still).toBeFocused();
  });

  test("Play in the preview dialog is a keyboard control that loads the player", async ({
    page,
  }) => {
    await openInbox(page, inboxPath);
    await page
      .getByRole("button", { name: "Preview Remy Jupille's video" })
      .click();
    const dialog = page.getByRole("dialog", { name: previewDialogName });
    const play = dialog.getByRole("button", {
      name: "Play Remy Jupille's testimonial",
    });
    await play.focus();
    await page.keyboard.press("Enter");
    await expect(dialog.locator("mux-player")).toHaveAttribute(
      "playback-id",
      "L2fsVjRn3fpD7OcP34HAZ7BIB99RlIUjgt4zaw3UW3Y",
    );
  });

  test("the details dialog traps focus and its Segmented choices are named, pressed and keyboard-operable", async ({
    page,
  }) => {
    await openInbox(page, detailsPath);
    const dialog = page.getByRole("dialog", { name: detailsDialogName });
    await expect(dialog).toBeVisible();
    expect((await focused(page)).inDialog).toBe(true);

    // Alice sent no photo, so Photo has no row: three named groups.
    const groups = dialog.getByRole("group");
    await expect(groups).toHaveCount(3);
    await expect(
      dialog.getByRole("group", { name: "Role", exact: true }),
    ).toBeVisible();
    const company = dialog.getByRole("group", { name: "Company" });
    await expect(company).toBeVisible();
    await expect(dialog.getByRole("group", { name: "Stars" })).toBeVisible();
    await expect(company.getByRole("button", { name: "Hide" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(
      company.getByRole("button", { name: "Wall default" }),
    ).toHaveAttribute("aria-pressed", "false");
    const preview = dialog.locator("[data-gsp-card]");
    await expect(preview).not.toContainText("Bellwether Coffee");

    const reached = new Set<string>();
    for (let index = 0; index < 14; index++) {
      await page.keyboard.press("Tab");
      const stop = await focused(page);
      expect(
        stop.inDialog,
        `Tab left the dialog to ${stop.role}: ${stop.name}`,
      ).toBe(true);
      reached.add(`${stop.role}: ${stop.name}`);
    }
    expect([...reached]).toEqual(
      expect.arrayContaining([
        "button: Wall default",
        "button: Show",
        "button: Hide",
        "button: Cancel",
        "button: Save",
        "button: Close",
      ]),
    );

    // Space on "Show" flips the choice and the preview card follows.
    const show = company.getByRole("button", { name: "Show" });
    await show.focus();
    await page.keyboard.press("Space");
    await expect(show).toHaveAttribute("aria-pressed", "true");
    await expect(company.getByRole("button", { name: "Hide" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await expect(preview).toContainText("Bellwether Coffee");

    // The fixture's onClose is a no-op, so Escape cannot close it here; it
    // must at least leave focus inside and the dialog intact.
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    expect((await focused(page)).inDialog).toBe(true);
  });

  test("the delete confirmation traps focus and names its two choices", async ({
    page,
  }) => {
    await openInbox(page, deletePath);
    const dialog = page.getByRole("alertdialog", {
      name: "Delete Remy Jupille's Testimonial?",
    });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("permanent");
    expect((await focused(page)).inDialog).toBe(true);
    const reached = new Set<string>();
    for (let index = 0; index < 4; index++) {
      await page.keyboard.press("Tab");
      const stop = await focused(page);
      expect(stop.inDialog).toBe(true);
      reached.add(`${stop.role}: ${stop.name}`);
    }
    expect([...reached].sort()).toEqual(["button: Cancel", "button: Delete"]);
  });

  test("the arrows reorder from the keyboard and keep focus on the moved row", async ({
    page,
  }) => {
    await openInbox(page, inboxPath);
    await tab(page, "Published").click();
    const rows = page.locator('[data-testid^="inbox-testimonial-"]');
    await expect(rows).toHaveText([/Remy Jupille/, /Alice Martin/]);
    const down = page.getByRole("button", { name: "Move Remy Jupille down" });
    await down.focus();
    await page.keyboard.press("Enter");
    await expect(rows).toHaveText([/Alice Martin/, /Remy Jupille/]);
    await expect(
      page.getByRole("button", { name: "Move Remy Jupille down" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Move Alice Martin up" }),
    ).toBeDisabled();
    const afterMove = await focused(page);
    test.info().annotations.push({
      description: `after Enter on "Move Remy Jupille down", focus is on ${afterMove.role}: "${afterMove.name}"`,
      type: "focus-after-reorder",
    });
    // A keyboard user who just moved a row must not be thrown back to the
    // top of the document (WCAG 2.4.3 Focus Order: a meaningful sequence).
    expect(
      afterMove.role,
      "focus was lost to <body> after the reorder",
    ).not.toBe("body");
  });

  test("every icon-only control carries an accessible name", async ({
    page,
  }) => {
    const unnamed = async (context: string) => {
      const names = await page
        .locator("button:visible, a[href]:visible, [role=button]:visible")
        .evaluateAll((elements) =>
          elements
            .map((element) => {
              const label = element.getAttribute("aria-label");
              const labelledBy = element.getAttribute("aria-labelledby");
              const text = (element.textContent ?? "")
                .replace(/\s+/g, " ")
                .trim();
              const name =
                label ??
                (labelledBy
                  ? labelledBy
                      .split(" ")
                      .map(
                        (id) => document.getElementById(id)?.textContent ?? "",
                      )
                      .join(" ")
                      .trim()
                  : text);
              return { html: element.outerHTML.slice(0, 120), name };
            })
            .filter(({ name }) => name.length === 0),
        );
      expect(names, context).toEqual([]);
    };
    await openInbox(page, inboxPath);
    await unnamed("Pending");
    await tab(page, "Published").click();
    await expect(page.getByRole("button", { name: "Unpublish" })).toHaveCount(
      2,
    );
    await unnamed("Published");
    await tab(page, "Spam").click();
    await expect(page.getByRole("button", { name: "Not Spam" })).toBeVisible();
    await unnamed("Spam");
    await tab(page, "Pending").click();
    await page
      .getByRole("button", { name: "Preview Remy Jupille's video" })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await unnamed("preview dialog");
  });

  test("the Open Public Wall link opens the Wall in a new tab", async ({
    page,
  }) => {
    await openInbox(page, inboxPath);
    const link = page.getByRole("link", { name: "Open Public Wall" });
    await expect(link).toHaveAttribute("href", "/w/fernhill-studio");
    await expect(link).toHaveAttribute("target", "_blank");
  });

  test("the status Badge and the blob loader reach assistive tech", async ({
    page,
  }) => {
    await openInbox(page, inboxPath);
    const row = page.getByTestId("inbox-testimonial-fixture-processing-video");
    const badge = row.locator('[data-slot="badge"]');
    await expect(badge).toHaveText("Processing");
    await expect(badge).toBeVisible();
    expect(
      await badge.evaluate((element) =>
        Boolean(element.closest('[aria-hidden="true"]')),
      ),
      "the Badge is inside an aria-hidden subtree",
    ).toBe(false);
    const snapshot = await row.ariaSnapshot();
    expect(snapshot).toContain("Processing");
    expect(snapshot).toContain("Publish once the video is Ready.");

    const loader = row.locator('[role="status"]');
    await expect(loader).toHaveCount(1);
    await expect(loader).toHaveAttribute("aria-live", "polite");
    await expect(loader).toContainText("Nora Lewis's video is processing");
    const occurrences =
      snapshot.split("Nora Lewis's video is processing").length - 1;
    test.info().annotations.push({
      description: `the loader label appears ${occurrences} time(s) in the row's accessibility tree`,
      type: "loader-label-occurrences",
    });
    expect(occurrences).toBeGreaterThanOrEqual(1);
  });

  test("the video still shows a visible focus ring when reached from the keyboard", async ({
    page,
  }) => {
    await openInbox(page, inboxPath);
    // Reach it with a real Tab so :focus-visible applies.
    await page
      .getByRole("button", {
        name: "More actions for Alice Martin's Testimonial",
      })
      .focus();
    await page.keyboard.press("Tab");
    const still = page.getByRole("button", {
      name: "Preview Remy Jupille's video",
    });
    await expect(still).toBeFocused();
    expect(
      await still.evaluate((element) => element.matches(":focus-visible")),
    ).toBe(true);
    // The ring is a box-shadow that transitions in (DESIGN.md section 8 lets
    // focus rings use --ease-out-soft), so read it once it has settled.
    const readRing = () =>
      still.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          boxShadow: style.boxShadow,
          outlineStyle: style.outlineStyle,
          outlineWidth: style.outlineWidth,
        };
      });
    await expect
      .poll(async () => (await readRing()).boxShadow, { timeout: 2_000 })
      .toMatch(/0px 0px 0px 3px/);
    const ring = await readRing();
    test.info().annotations.push({
      description: JSON.stringify(ring),
      type: "still-focus-ring",
    });
    const ringColor = /(oklch\([^)]*\)|rgba?\([^)]*\))\s+0px 0px 0px 3px/.exec(
      ring.boxShadow,
    )?.[1];
    expect(ringColor, `ring colour in ${ring.boxShadow}`).toBeTruthy();
    // A transparent ring would be no ring.
    expect(ringColor).not.toMatch(/\/\s*0\)|,\s*0\)$/);
  });

  test("the tab counts keep AA contrast on both the active and the inactive tabs", async ({
    page,
  }) => {
    await openInbox(page, inboxPath);
    const ratios = await page.getByRole("tab").evaluateAll((tabs) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const context = canvas.getContext("2d", { willReadFrequently: true })!;
      const rgbOf = (fills: string[]) => {
        context.clearRect(0, 0, 1, 1);
        for (const fill of fills) {
          context.fillStyle = fill;
          context.fillRect(0, 0, 1, 1);
        }
        return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
      };
      const luminance = ([r, g, b]: number[]) => {
        const channel = (value: number) => {
          const c = value / 255;
          return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        };
        return (
          0.2126 * channel(r!) + 0.7152 * channel(g!) + 0.0722 * channel(b!)
        );
      };
      const backgroundStack = (element: Element) => {
        const fills: string[] = [];
        for (
          let node: Element | null = element;
          node;
          node = node.parentElement
        ) {
          const background = getComputedStyle(node).backgroundColor;
          if (background && background !== "rgba(0, 0, 0, 0)")
            fills.unshift(background);
        }
        fills.unshift(
          getComputedStyle(document.documentElement).backgroundColor,
        );
        return fills;
      };
      return tabs.flatMap((tabElement) => {
        const count = tabElement.querySelector("span");
        if (!count) return [];
        const style = getComputedStyle(count);
        const foreground = rgbOf([style.color]);
        const background = rgbOf(backgroundStack(count));
        const [light, dark] = [
          luminance(foreground),
          luminance(background),
        ].sort((a, b) => b - a);
        return [
          {
            font: `${style.fontSize}/${style.fontWeight}`,
            ratio: Number(((light! + 0.05) / (dark! + 0.05)).toFixed(2)),
            state: tabElement.getAttribute("data-state"),
            tab: tabElement.textContent?.trim(),
          },
        ];
      });
    });
    test.info().annotations.push({
      description: JSON.stringify(ratios),
      type: "tab-count-contrast",
    });
    expect(ratios.length).toBeGreaterThan(1);
    for (const entry of ratios) {
      expect(entry.ratio, JSON.stringify(entry)).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("row controls keep their touch height", async ({ page }) => {
    await openInbox(page, inboxPath);
    const minimum = page.viewportSize()!.width < 768 ? 40 : 36;
    const short = await page
      .locator('[data-testid^="inbox-testimonial-"] button:visible')
      .evaluateAll(
        (elements, floor) =>
          elements
            .map((element) => ({
              height: element.getBoundingClientRect().height,
              name:
                element.getAttribute("aria-label") ??
                element.textContent?.trim(),
              width: element.getBoundingClientRect().width,
            }))
            .filter(({ height, width }) => height < floor || width < 24),
        minimum,
      );
    expect(short).toEqual([]);
  });
});
