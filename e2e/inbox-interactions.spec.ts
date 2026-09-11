import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Every control of the redesigned Inbox that works in the fixture pages,
 * driven in a real browser: the tabs and their counts, the still that opens
 * the playable card, the Published arrows and drag, the details dialog, the
 * delete confirmation, the empty-state action, the Spam row and the "..."
 * menu per row state. Fixture callbacks that are no-ops (Publish, Archive,
 * Save, Delete...) are only asserted as present and enabled.
 */

const routes = {
  delete: "/visual-evidence/testimonial-delete",
  details: "/visual-evidence/testimonial-inbox-details",
  inbox: "/visual-evidence/testimonial-inbox",
  published: "/visual-evidence/testimonial-inbox-published",
} as const;

const ids = {
  alice: "inbox-testimonial-fixture-testimonial",
  nora: "inbox-testimonial-fixture-processing-video",
  remy: "inbox-testimonial-fixture-video-testimonial",
  spam: "inbox-testimonial-fixture-spam-testimonial",
} as const;

const anyApostrophe = "[’']";
const previewDialogName = new RegExp(`^Remy Jupille${anyApostrophe}s video$`);
const detailsDialogName = new RegExp(
  `^Details on Alice Martin${anyApostrophe}s card$`,
);
const deleteDialogName = new RegExp(
  `^Delete Remy Jupille${anyApostrophe}s Testimonial\\?$`,
);

function rows(page: Page) {
  return page.locator('li[data-testid^="inbox-testimonial-"]');
}

function rowIds(page: Page) {
  return rows(page).evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("data-testid")),
  );
}

function row(page: Page, id: string) {
  return page.getByTestId(id);
}

function tab(page: Page, name: string) {
  return page.getByRole("tab", { name, exact: true });
}

async function openMenu(page: Page, submitterName: string) {
  await page
    .getByRole("button", {
      name: `More actions for ${submitterName}'s Testimonial`,
      exact: true,
    })
    .click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  return menu;
}

async function menuLabels(menu: Locator) {
  const labels = await menu.getByRole("menuitem").allTextContents();
  return labels.map((label) => label.trim());
}

async function closeMenu(page: Page) {
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(overflow.scrollWidth, JSON.stringify(overflow)).toBeLessThanOrEqual(
    overflow.innerWidth,
  );
}

async function gotoInbox(page: Page, route: string = routes.inbox) {
  await page.goto(route);
  // A CSS locator: on the routes that open a modal, the page behind it is
  // aria-hidden and the heading leaves the role tree.
  await expect(page.locator("h1", { hasText: "Inbox" })).toBeVisible();
}

test.describe("Inbox header and tabs", () => {
  test("does not offer assistant import from the Inbox header", async ({
    page,
  }) => {
    await gotoInbox(page);
    await expect(
      page.getByRole("link", {
        name: /Import with an assistant/,
      }),
    ).toHaveCount(0);
  });

  test("Open Public Wall links to the Brand's wall in a new tab", async ({
    page,
  }) => {
    await gotoInbox(page);
    const link = page.getByRole("link", { name: "Open Public Wall" });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/w/fernhill-studio");
    await expect(link).toHaveAttribute("target", "_blank");
  });

  test("the four category tabs carry their counts and switch the list", async ({
    page,
  }) => {
    await gotoInbox(page);
    const tabs = page.getByRole("tablist", { name: "Testimonial categories" });
    await expect(tabs.getByRole("tab")).toHaveText([
      /^Pending\s+3$/,
      /^Published\s+2$/,
      /^Archived\s*$/,
      /^Spam\s+1$/,
    ]);
    await expect(tab(page, "Pending 3")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(await rowIds(page)).toEqual([ids.nora, ids.alice, ids.remy]);

    await tab(page, "Published 2").click();
    await expect(tab(page, "Published 2")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(tab(page, "Pending 3")).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(await rowIds(page)).toEqual([ids.remy, ids.alice]);

    await tab(page, "Archived").click();
    await expect(tab(page, "Archived")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(
      page.getByRole("heading", { name: "Nothing Archived" }),
    ).toBeVisible();
    await expect(rows(page)).toHaveCount(0);

    await tab(page, "Spam 1").click();
    await expect(tab(page, "Spam 1")).toHaveAttribute("aria-selected", "true");
    expect(await rowIds(page)).toEqual([ids.spam]);

    await tab(page, "Pending 3").click();
    expect(await rowIds(page)).toEqual([ids.nora, ids.alice, ids.remy]);
  });

  test("no tab makes the page scroll sideways", async ({ page }) => {
    await gotoInbox(page);
    for (const name of ["Pending 3", "Published 2", "Archived", "Spam 1"]) {
      await tab(page, name).click();
      await expect(tab(page, name)).toHaveAttribute("aria-selected", "true");
      await expectNoHorizontalScroll(page);
    }
  });
});

test.describe("Pending rows", () => {
  test("Publish waits for a Ready video; Archive is offered on every Pending row", async ({
    page,
  }) => {
    await gotoInbox(page);

    const nora = row(page, ids.nora);
    await expect(nora.getByText("Processing", { exact: true })).toBeVisible();
    await expect(
      nora.getByText("Publish once the video is Ready."),
    ).toBeVisible();
    await expect(
      nora.getByTestId("processing-video-placeholder"),
    ).toBeVisible();
    await expect(
      nora.getByRole("button", { name: "Publish", exact: true }),
    ).toBeDisabled();
    await expect(
      nora.getByRole("button", { name: "Archive", exact: true }),
    ).toBeEnabled();

    const alice = row(page, ids.alice);
    await expect(alice.getByText("Founder · Bellwether Coffee")).toBeVisible();
    await expect(alice.getByText("alice@example.invalid")).toBeVisible();
    await expect(
      alice.getByRole("button", { name: "Publish", exact: true }),
    ).toBeEnabled();
    await expect(
      alice.getByRole("button", { name: "Archive", exact: true }),
    ).toBeEnabled();

    const remy = row(page, ids.remy);
    await expect(
      remy.getByRole("button", { name: "Publish", exact: true }),
    ).toBeEnabled();
    await expect(
      remy.getByRole("button", { name: "Archive", exact: true }),
    ).toBeEnabled();
    await expect(remy.getByText("0:42")).toBeVisible();

    // Nothing to reorder and nothing to unpublish outside Published.
    await expect(page.getByRole("button", { name: /^Move / })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Unpublish", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Not Spam", exact: true }),
    ).toHaveCount(0);
  });

  test("the row keeps DESIGN.md's measures: 48px portrait still, 16px from the edge, 40px buttons at most", async ({
    page,
  }) => {
    await gotoInbox(page);
    const still = page.getByRole("button", {
      name: "Preview Remy Jupille's video",
    });
    const stillBox = await still.boundingBox();
    expect(stillBox?.width).toBe(48);
    // 9:16 keeps the portrait shape: taller than wide, never a landscape crop.
    expect(stillBox?.height).toBeGreaterThan(80);

    const remy = row(page, ids.remy);
    const rowBox = await remy.boundingBox();
    expect(stillBox!.x - rowBox!.x).toBeGreaterThanOrEqual(16);

    const buttonHeights = await remy
      .getByRole("button")
      .evaluateAll((elements) =>
        elements.map((element) => ({
          height: element.getBoundingClientRect().height,
          label:
            element.getAttribute("aria-label") ?? element.textContent?.trim(),
        })),
      );
    for (const button of buttonHeights) {
      if (button.label?.startsWith("Preview")) continue;
      // DESIGN.md section 7: buttons are 40px in the app (44 on public surfaces).
      expect(button.height, button.label).toBeLessThanOrEqual(40);
      expect(button.height, button.label).toBeGreaterThanOrEqual(36);
    }
  });
});

test.describe("The still opens the playable card", () => {
  test("Play loads the Mux player; Escape, the X and the overlay each close it", async ({
    browserName,
    isMobile,
    page,
  }) => {
    // Mobile WebKit never brings the Mux player up in CI (the visual-evidence
    // spec is ignored there for the same reason), so it checks the dialog's
    // ways out and leaves playback to the other four projects.
    const playsVideo = !(isMobile && browserName === "webkit");
    await gotoInbox(page);
    const still = page.getByRole("button", {
      name: "Preview Remy Jupille's video",
    });
    const dialog = page.getByRole("dialog", { name: previewDialogName });

    await still.click();
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText("The card exactly as it plays on your Public Wall."),
    ).toBeVisible();
    const card = dialog.locator("[data-gsp-card]");
    await expect(card).toBeVisible();
    const shell = card.locator(".video-shell");
    await expect(shell).not.toHaveAttribute("data-video-active", "");

    if (playsVideo) {
      // The player may already be warmed by the pointer resting on the
      // shell; Play is what activates the video and swaps the button to
      // Pause.
      await dialog
        .getByRole("button", { name: "Play Remy Jupille's testimonial" })
        .click();
      await expect(shell).toHaveAttribute("data-video-active", "");
      await expect(page.getByTestId("mux-video-player")).toBeVisible();
      await page.waitForFunction(() => customElements.get("mux-player"));
      const muxPlayer = page
        .getByTestId("mux-video-player")
        .locator("mux-player:not([data-mux-player-react-lazy-placeholder])");
      await expect(muxPlayer).toBeVisible();
      await muxPlayer.dispatchEvent("playing");
      await expect(
        dialog.getByRole("button", {
          name: "Pause Remy Jupille's testimonial",
        }),
      ).toBeVisible();
    }

    // 1. Escape
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId("mux-video-player")).toHaveCount(0);

    // 2. The X button
    await still.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await expect(dialog).toBeHidden();

    // 3. The overlay
    await still.click();
    await expect(dialog).toBeVisible();
    await page
      .locator('[data-slot="dialog-overlay"]')
      .click({ position: { x: 6, y: 6 } });
    await expect(dialog).toBeHidden();
  });

  test("closing the card returns keyboard focus to the still that opened it", async ({
    page,
  }) => {
    await gotoInbox(page);
    const still = page.getByRole("button", {
      name: "Preview Remy Jupille's video",
    });
    const dialog = page.getByRole("dialog", { name: previewDialogName });

    await still.focus();
    await expect(still).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(still).toBeFocused();
  });
});

test.describe("The '...' menu per row state", () => {
  test("Pending: the tools the row can use, then Mark as Spam and Delete", async ({
    page,
  }) => {
    await gotoInbox(page);

    // A processing video has no tool yet.
    let menu = await openMenu(page, "Nora Lewis");
    expect(await menuLabels(menu)).toEqual([
      "Mark as Spam",
      "Delete permanently",
    ]);
    await expect(menu.getByRole("separator")).toHaveCount(0);
    await closeMenu(page);

    // A text Testimonial can be highlighted.
    menu = await openMenu(page, "Alice Martin");
    expect(await menuLabels(menu)).toEqual([
      "Highlight a phrase",
      "Mark as Spam",
      "Delete permanently",
    ]);
    await expect(menu.getByRole("separator")).toHaveCount(1);
    await closeMenu(page);

    // A Ready video gets its thumbnail changed.
    menu = await openMenu(page, "Remy Jupille");
    expect(await menuLabels(menu)).toEqual([
      "Change thumbnail",
      "Mark as Spam",
      "Delete permanently",
    ]);
    await closeMenu(page);
  });

  test("Published: Show or hide details joins the tools", async ({ page }) => {
    await gotoInbox(page, routes.published);
    await expect(tab(page, "Published 2")).toHaveAttribute(
      "aria-selected",
      "true",
    );

    let menu = await openMenu(page, "Remy Jupille");
    expect(await menuLabels(menu)).toEqual([
      "Change thumbnail",
      "Show or hide details",
      "Mark as Spam",
      "Delete permanently",
    ]);
    await closeMenu(page);

    menu = await openMenu(page, "Alice Martin");
    expect(await menuLabels(menu)).toEqual([
      "Highlight a phrase",
      "Show or hide details",
      "Mark as Spam",
      "Delete permanently",
    ]);
    await closeMenu(page);
  });

  test("Spam: only Delete permanently", async ({ page }) => {
    await gotoInbox(page);
    await tab(page, "Spam 1").click();
    const menu = await openMenu(page, "Suspicious Submission");
    expect(await menuLabels(menu)).toEqual(["Delete permanently"]);
    await expect(menu.getByRole("separator")).toHaveCount(0);
    await closeMenu(page);
  });
});

test.describe("Published order", () => {
  test("the arrows move a row and are disabled at the ends", async ({
    page,
  }) => {
    await gotoInbox(page, routes.published);
    await expect(
      page.getByText(
        "Visitors see your Public Wall in this order. Drag a row, or use the arrows.",
      ),
    ).toBeVisible();
    expect(await rowIds(page)).toEqual([ids.remy, ids.alice]);

    const remyUp = page.getByRole("button", { name: "Move Remy Jupille up" });
    const remyDown = page.getByRole("button", {
      name: "Move Remy Jupille down",
    });
    const aliceUp = page.getByRole("button", { name: "Move Alice Martin up" });
    const aliceDown = page.getByRole("button", {
      name: "Move Alice Martin down",
    });
    await expect(remyUp).toBeDisabled();
    await expect(remyDown).toBeEnabled();
    await expect(aliceUp).toBeEnabled();
    await expect(aliceDown).toBeDisabled();

    // The decision on a Published row is Unpublish, nothing else.
    for (const id of [ids.remy, ids.alice]) {
      await expect(
        row(page, id).getByRole("button", { name: "Unpublish", exact: true }),
      ).toBeEnabled();
      await expect(
        row(page, id).getByRole("button", { name: "Publish", exact: true }),
      ).toHaveCount(0);
      await expect(
        row(page, id).getByRole("button", { name: "Archive", exact: true }),
      ).toHaveCount(0);
    }

    await remyDown.click();
    await expect.poll(() => rowIds(page)).toEqual([ids.alice, ids.remy]);
    await expect(aliceUp).toBeDisabled();
    await expect(aliceDown).toBeEnabled();
    await expect(remyUp).toBeEnabled();
    await expect(remyDown).toBeDisabled();

    await aliceDown.click();
    await expect.poll(() => rowIds(page)).toEqual([ids.remy, ids.alice]);
  });

  test("a row can be dragged onto another (DOM drag events)", async ({
    page,
  }) => {
    await gotoInbox(page, routes.published);
    const remy = row(page, ids.remy);
    const alice = row(page, ids.alice);
    await expect(remy).toHaveAttribute("draggable", "true");
    await expect(alice).toHaveAttribute("draggable", "true");

    const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
    await remy.dispatchEvent("dragstart", { dataTransfer });
    await alice.dispatchEvent("dragover", { dataTransfer });
    await alice.dispatchEvent("drop", { dataTransfer });
    await remy.dispatchEvent("dragend", { dataTransfer });
    await expect.poll(() => rowIds(page)).toEqual([ids.alice, ids.remy]);

    // And back up, dropping the last row onto the first.
    await remy.dispatchEvent("dragstart", { dataTransfer });
    await alice.dispatchEvent("dragover", { dataTransfer });
    await alice.dispatchEvent("drop", { dataTransfer });
    await remy.dispatchEvent("dragend", { dataTransfer });
    await expect.poll(() => rowIds(page)).toEqual([ids.remy, ids.alice]);
  });

  test("a row can be dragged with the pointer", async ({ page, isMobile }) => {
    // HTML5 drag and drop is a pointer affordance; a phone has the arrows
    // (the grip is hidden below md).
    test.skip(isMobile, "Touch has no HTML5 drag; the arrows serve there.");
    await gotoInbox(page, routes.published);
    await row(page, ids.remy).dragTo(row(page, ids.alice));
    await expect.poll(() => rowIds(page)).toEqual([ids.alice, ids.remy]);
  });

  test("the grip hides on a phone and shows on a desktop", async ({
    page,
    isMobile,
  }) => {
    await gotoInbox(page, routes.published);
    const grip = row(page, ids.remy).locator("svg.cursor-grab");
    await expect(grip).toHaveCount(1);
    if (isMobile) await expect(grip).toBeHidden();
    else await expect(grip).toBeVisible();
  });
});

test.describe("Empty and Spam categories", () => {
  test("the empty Archived tab sends the Owner back to Pending", async ({
    page,
  }) => {
    await gotoInbox(page);
    await tab(page, "Archived").click();
    await expect(
      page.getByRole("heading", { name: "Nothing Archived" }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Testimonials you keep but hide from the public land here.",
      ),
    ).toBeVisible();
    await page.getByRole("button", { name: "Go to Pending" }).click();
    await expect(tab(page, "Pending 3")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(await rowIds(page)).toEqual([ids.nora, ids.alice, ids.remy]);
    await expect(
      page.getByRole("button", { name: "Go to Pending" }),
    ).toHaveCount(0);
  });

  test("the Spam row offers Not Spam, the quarantine date, and no decision", async ({
    page,
  }) => {
    await gotoInbox(page);
    await tab(page, "Spam 1").click();
    const spam = row(page, ids.spam);
    await expect(spam).toBeVisible();
    await expect(
      spam.getByRole("button", { name: "Not Spam", exact: true }),
    ).toBeEnabled();
    await expect(spam.getByText(/^Deleted on /)).toBeVisible();
    await expect(
      spam.getByRole("button", { name: "Publish", exact: true }),
    ).toHaveCount(0);
    await expect(
      spam.getByRole("button", { name: "Archive", exact: true }),
    ).toHaveCount(0);
    await expect(
      spam.getByRole("button", { name: "Unpublish", exact: true }),
    ).toHaveCount(0);
    await expect(spam.getByRole("button", { name: /^Move / })).toHaveCount(0);
  });
});

test.describe("Details on a card (WallDisplayDialog)", () => {
  test("each Segmented choice updates the real card preview", async ({
    page,
  }) => {
    await gotoInbox(page, routes.details);
    const dialog = page.getByRole("dialog", { name: detailsDialogName });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText(
        "Your Wall settings decide for every card. Choose here for this one only.",
      ),
    ).toBeVisible();
    await expectNoHorizontalScroll(page);
    const dialogOverflow = await dialog.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(
      dialogOverflow.scrollWidth,
      JSON.stringify(dialogOverflow),
    ).toBeLessThanOrEqual(dialogOverflow.clientWidth);

    // Alice sent no photo, so there is no Photo choice: a choice about nothing is noise.
    await expect(dialog.getByRole("group", { name: "Photo" })).toHaveCount(0);
    const role = dialog.getByRole("group", { name: "Role" });
    const company = dialog.getByRole("group", { name: "Company" });
    const stars = dialog.getByRole("group", { name: "Stars" });
    await expect(role).toBeVisible();
    await expect(company).toBeVisible();
    await expect(stars).toBeVisible();
    await expect(dialog.getByText("shown by default")).toHaveCount(3);

    const card = dialog.locator("[data-gsp-card]");
    await expect(card).toBeVisible();
    await expect(card).toContainText("Alice Martin");

    // Company arrives hidden by an override.
    const pressed = (group: Locator) =>
      group.locator('button[aria-pressed="true"]').textContent();
    expect((await pressed(company))?.trim()).toBe("Hide");
    expect((await pressed(role))?.trim()).toBe("Wall default");
    expect((await pressed(stars))?.trim()).toBe("Wall default");
    await expect(card).not.toContainText("Bellwether Coffee");
    await expect(card).toContainText("Founder");

    await company.getByRole("button", { name: "Show", exact: true }).click();
    await expect(
      company.getByRole("button", { name: "Show", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      company.getByRole("button", { name: "Hide", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
    await expect(card).toContainText("Bellwether Coffee");

    await company.getByRole("button", { name: "Hide", exact: true }).click();
    await expect(card).not.toContainText("Bellwether Coffee");

    await company
      .getByRole("button", { name: "Wall default", exact: true })
      .click();
    await expect(
      company.getByRole("button", { name: "Wall default", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    // The Wall shows companies by default, so the card shows it again.
    await expect(card).toContainText("Bellwether Coffee");

    await role.getByRole("button", { name: "Hide", exact: true }).click();
    await expect(
      role.getByRole("button", { name: "Hide", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(card).not.toContainText("Founder");
    await role.getByRole("button", { name: "Show", exact: true }).click();
    await expect(card).toContainText("Founder");

    const starsImage = card.getByRole("img", { name: "5 out of 5 stars" });
    await expect(starsImage).toBeVisible();
    await stars.getByRole("button", { name: "Hide", exact: true }).click();
    await expect(
      stars.getByRole("button", { name: "Hide", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(starsImage).toHaveCount(0);
    await stars.getByRole("button", { name: "Show", exact: true }).click();
    await expect(starsImage).toBeVisible();

    await expect(
      dialog.getByRole("button", { name: "Cancel", exact: true }),
    ).toBeEnabled();
    await expect(
      dialog.getByRole("button", { name: "Save", exact: true }),
    ).toBeEnabled();
    await expect(
      dialog.getByRole("button", { name: "Close", exact: true }),
    ).toBeVisible();
  });

  test("the Segmented groups have one pressed choice and keyboard focus rings", async ({
    page,
  }) => {
    await gotoInbox(page, routes.details);
    const dialog = page.getByRole("dialog", { name: detailsDialogName });
    for (const name of ["Role", "Company", "Stars"]) {
      const group = dialog.getByRole("group", { name });
      await expect(group.getByRole("button")).toHaveText([
        "Wall default",
        "Show",
        "Hide",
      ]);
      await expect(group.locator('button[aria-pressed="true"]')).toHaveCount(1);
    }
  });
});

test.describe("Delete confirmation", () => {
  test("the delete route shows an alert dialog with Cancel and Delete", async ({
    page,
  }) => {
    await gotoInbox(page, routes.delete);
    const dialog = page.getByRole("alertdialog", { name: deleteDialogName });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText(
        "This permanently removes the Testimonial and its media. There is no undo.",
      ),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Cancel", exact: true }),
    ).toBeEnabled();
    await expect(
      dialog.getByRole("button", { name: "Delete", exact: true }),
    ).toBeEnabled();
    // An alert dialog has no X: the Owner answers the question.
    await expect(
      dialog.getByRole("button", { name: "Close", exact: true }),
    ).toHaveCount(0);
    await expectNoHorizontalScroll(page);
  });
});
