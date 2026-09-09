import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

test("MCP Apps import refreshes video progress and retries a failed copy", async ({
  page,
}, testInfo) => {
  await page.route("**/mcp-progress-test", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Import progress test</title></head><body style="margin:0"><iframe title="Import testimonials" src="/chatgpt/import-widget.html" style="width:100%;height:100dvh;border:0"></iframe></body></html>',
    }),
  );
  await page.addInitScript(() => {
    if (window.parent !== window) return;
    let status = "failed";
    const snapshot = () => ({
      jobId: "import-willow",
      organizationSlug: "willow",
      inboxUrl: "https://proof.example/org/willow/inbox?import=import-willow",
      result: {
        imported: status === "ready" ? 1 : 0,
        skipped: 0,
        changed: 0,
        unavailable: 0,
        processing: status === "processing" ? 1 : 0,
        failed: status === "failed" ? 1 : 0,
      },
      videos: [
        { itemId: "video-camille", authorName: "Camille Roche", status },
      ],
    });
    window.addEventListener("message", (event) => {
      const frame = document.querySelector("iframe")?.contentWindow;
      if (!frame || event.source !== frame || event.data?.jsonrpc !== "2.0")
        return;
      const message = event.data;
      const send = (value: unknown) =>
        frame.postMessage(value, window.location.origin);
      if (message.method === "ui/initialize")
        send({
          jsonrpc: "2.0",
          id: message.id,
          result: {
            protocolVersion: message.params.protocolVersion,
            hostInfo: { name: "GSP test host", version: "1.0.0" },
            hostCapabilities: { serverTools: {} },
            hostContext: { theme: "light" },
          },
        });
      if (message.method === "ui/notifications/initialized")
        send({
          jsonrpc: "2.0",
          method: "ui/notifications/tool-result",
          params: { content: [], structuredContent: snapshot() },
        });
      if (message.method === "tools/call") {
        if (message.params.arguments.jobId !== "import-willow")
          throw new Error("Wrong job");
        if (message.params.name === "retry_import_video") {
          if (message.params.arguments.itemId !== "video-camille")
            throw new Error("Wrong video");
          status = "processing";
          document.body.dataset.retries = String(
            Number(document.body.dataset.retries ?? 0) + 1,
          );
        } else if (message.params.name === "read_testimonial_import") {
          if (status === "processing") status = "ready";
        } else throw new Error("Unexpected progress tool");
        send({
          jsonrpc: "2.0",
          id: message.id,
          result: { content: [], structuredContent: snapshot() },
        });
      }
    });
  });
  await page.goto("/mcp-progress-test");
  const app = page.frameLocator("iframe");
  await expect(app.getByText("Failed", { exact: true })).toBeVisible();
  for (const theme of ["light", "dark"]) {
    await page.evaluate(
      (theme) =>
        document.querySelector("iframe")!.contentWindow!.postMessage(
          {
            jsonrpc: "2.0",
            method: "ui/notifications/host-context-changed",
            params: { theme },
          },
          window.location.origin,
        ),
      theme,
    );
    await expect(app.locator("html")).toHaveClass(
      theme === "dark" ? /dark/ : /^((?!dark).)*$/,
    );
    await page.waitForTimeout(250);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    if (process.env.CHATGPT_WIDGET_CAPTURE_DIR) {
      await mkdir(process.env.CHATGPT_WIDGET_CAPTURE_DIR, { recursive: true });
      await page.screenshot({
        animations: "disabled",
        path: path.join(
          process.env.CHATGPT_WIDGET_CAPTURE_DIR,
          `${testInfo.project.name}-video-progress-${theme}.png`,
        ),
      });
    }
  }
  await app
    .getByRole("button", { name: "Retry video for Camille Roche" })
    .click();
  await expect(
    app.getByRole("heading", { name: "Importing your videos" }),
  ).toBeVisible();
  await expect(app.getByText("Processing", { exact: true })).toBeVisible();
  await expect(app.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 10000,
  });
  await expect(
    app.getByRole("heading", { name: "Your testimonials are in" }),
  ).toBeVisible();
  await expect(page.locator("body")).toHaveAttribute("data-retries", "1");
});

test("MCP Apps component keeps server selection across filters and follows the host theme", async ({
  page,
}, testInfo) => {
  await page.route("**/mcp-host-test", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>MCP Apps test host</title></head><body style="margin:0"><iframe title="Import testimonials" src="/chatgpt/import-widget.html" style="width:100%;height:100dvh;border:0"></iframe></body></html>',
    }),
  );
  await page.addInitScript(() => {
    if (window.parent !== window) return;
    const snapshot = {
      provider: "testimonial-to",
      sourceUrl: "https://testimonial.to/atelier-june/all",
      itemCount: 2,
      expiresAt: 9999999999999,
      selectedPositions: [0],
      nextOffset: null,
      items: [
        {
          position: 0,
          sourceId: "camille",
          type: "text",
          authorName: "Camille Laurent",
          text: "Our customers can find the right proof before getting in touch.",
        },
        {
          position: 1,
          sourceId: "daniel",
          type: "text",
          authorName: "Daniel Reed",
          text: "Our clients' original words stayed intact throughout the move.",
        },
      ],
    };
    let linkAttempts = 0;
    window.addEventListener("message", (event) => {
      const frame = document.querySelector("iframe")?.contentWindow;
      if (!frame || event.source !== frame || event.data?.jsonrpc !== "2.0")
        return;
      const message = event.data;
      const send = (value: unknown) =>
        frame.postMessage(value, window.location.origin);
      if (message.method === "ui/initialize")
        send({
          jsonrpc: "2.0",
          id: message.id,
          result: {
            protocolVersion: message.params.protocolVersion,
            hostInfo: { name: "GSP test host", version: "1.0.0" },
            hostCapabilities: { serverTools: {} },
            hostContext: { theme: "light" },
          },
        });
      if (message.method === "ui/notifications/initialized")
        send({
          jsonrpc: "2.0",
          method: "ui/notifications/tool-result",
          params: {
            structuredContent: snapshot,
            content: [],
            _meta: { previewCapability: "a".repeat(64) },
          },
        });
      if (message.method === "ui/open-link") {
        if (
          message.params.url !==
          `https://proof.example/import/continue#preview=${"a".repeat(64)}`
        )
          throw new Error("Wrong continuation URL");
        linkAttempts++;
        send({
          jsonrpc: "2.0",
          id: message.id,
          result: { isError: linkAttempts === 1 },
        });
        document.body.dataset.websiteOpened = String(linkAttempts > 1);
      }
      if (message.method === "tools/call") {
        const args = message.params.arguments;
        if (message.params.name === "check_import_selection") {
          send({
            jsonrpc: "2.0",
            id: message.id,
            result: {
              content: [],
              structuredContent: {
                selected: snapshot.selectedPositions.length,
                text: snapshot.selectedPositions.length,
                video: 0,
                duplicates: 0,
                changed: 0,
                unavailable: 0,
                videoCapacityExceeded: 0,
                eligibleKeys: snapshot.selectedPositions.map(String),
              },
            },
          });
          return;
        }
        if (message.params.name === "list_import_projects") {
          send({
            jsonrpc: "2.0",
            id: message.id,
            result: {
              content: [],
              structuredContent: {
                page: [
                  {
                    id: "project-juniper",
                    name: "Juniper Studio",
                    slug: "juniper",
                    videoCapacity: {
                      used: 1,
                      limit: 2,
                      available: true,
                      configured: true,
                    },
                  },
                ],
                isDone: true,
                continueCursor: "",
              },
            },
          });
          return;
        }
        if (
          message.params.name === "save_testimonial_import" ||
          message.params.name === "read_testimonial_import"
        ) {
          if (
            message.params.name === "save_testimonial_import" &&
            (args.organizationId !== "project-juniper" ||
              args.previewCapability !== "a".repeat(64))
          )
            throw new Error("Wrong import destination or preview");
          send({
            jsonrpc: "2.0",
            id: message.id,
            result: {
              content: [],
              structuredContent: {
                videos: [],
                jobId: "import-juniper",
                organizationSlug: "juniper",
                inboxUrl: "https://proof.example/org/juniper/inbox",
                result: {
                  imported: snapshot.selectedPositions.length,
                  skipped: 0,
                  changed: 0,
                  unavailable: 0,
                },
              },
            },
          });
          return;
        }
        if (message.params.name === "correct_testimonial_identity") {
          if (args.previewCapability !== "a".repeat(64))
            throw new Error("Wrong preview capability");
          snapshot.items[args.position].authorName = args.authorName;
        }
        if (message.params.name === "select_testimonial_preview")
          snapshot.selectedPositions = args.positions;
        send({
          jsonrpc: "2.0",
          id: message.id,
          result: {
            structuredContent: {
              ...snapshot,
              items: args.type === "video" ? [] : snapshot.items,
            },
            content: [],
            _meta: {
              previewCapability: "a".repeat(64),
              ...(message.params.name === "continue_testimonial_import"
                ? {
                    continuationUrl: `https://proof.example/import/continue#preview=${"a".repeat(64)}`,
                  }
                : {}),
            },
          },
        });
      }
    });
  });
  await page.goto("/mcp-host-test");
  const app = page.frameLocator("iframe");
  expect(
    await app.locator("html").evaluate(() => window.innerWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width);
  await expect(
    app.getByRole("heading", { name: "Select testimonials" }),
  ).toBeVisible();
  const choice = app.getByRole("checkbox", {
    name: "Select Daniel Reed",
    exact: true,
  });
  await choice.click();
  await expect(choice).toBeChecked();
  await expect(app.getByText("2 selected", { exact: true })).toBeVisible();
  await app.getByRole("button", { name: "Video", exact: true }).click();
  await expect(
    app.getByText("No video testimonials in this preview.", { exact: true }),
  ).toBeVisible();
  await app.getByRole("button", { name: "Text", exact: true }).click();
  await expect(choice).toBeChecked();
  await app
    .getByRole("button", { name: "Correct details for Camille Laurent" })
    .click();
  const dialog = app.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Customer name").fill("Camille Moreau");
  await dialog.getByLabel("Role or company").fill("Founder, Atelier June");
  const identityAccessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(identityAccessibility.violations).toEqual([]);
  if (process.env.CHATGPT_WIDGET_CAPTURE_DIR) {
    await mkdir(process.env.CHATGPT_WIDGET_CAPTURE_DIR, { recursive: true });
    await app.locator("body").evaluate(() => document.fonts.ready);
    await page.screenshot({
      animations: "disabled",
      path: path.join(
        process.env.CHATGPT_WIDGET_CAPTURE_DIR,
        `${testInfo.project.name}-identity.png`,
      ),
    });
  }
  expect(
    (await dialog.getByRole("button", { name: "Save details" }).boundingBox())!
      .height,
  ).toBeGreaterThanOrEqual(44);
  await page.evaluate(() =>
    document.querySelector("iframe")!.contentWindow!.postMessage(
      {
        jsonrpc: "2.0",
        method: "ui/notifications/host-context-changed",
        params: { theme: "dark" },
      },
      window.location.origin,
    ),
  );
  await expect(app.locator("html")).toHaveClass(/dark/);
  // Let the host theme color transition settle before measuring contrast.
  await page.waitForTimeout(250);
  const darkIdentityAccessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(darkIdentityAccessibility.violations).toEqual([]);
  if (process.env.CHATGPT_WIDGET_CAPTURE_DIR) {
    await page.screenshot({
      animations: "disabled",
      path: path.join(
        process.env.CHATGPT_WIDGET_CAPTURE_DIR,
        `${testInfo.project.name}-identity-dark.png`,
      ),
    });
  }
  await page.evaluate(() =>
    document.querySelector("iframe")!.contentWindow!.postMessage(
      {
        jsonrpc: "2.0",
        method: "ui/notifications/host-context-changed",
        params: { theme: "light" },
      },
      window.location.origin,
    ),
  );
  await expect(app.locator("html")).not.toHaveClass(/dark/);
  await dialog.getByRole("button", { name: "Save details" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    app.getByRole("button", { name: "Correct details for Camille Moreau" }),
  ).toBeFocused();
  await expect(
    app.getByText(
      "Our customers can find the right proof before getting in touch.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(app.getByText("2 selected", { exact: true })).toBeVisible();
  if (process.env.CHATGPT_WIDGET_CAPTURE_DIR) {
    await mkdir(process.env.CHATGPT_WIDGET_CAPTURE_DIR, { recursive: true });
    await app.locator("body").evaluate(() => document.fonts.ready);
    await page.waitForTimeout(250);
    await page.screenshot({
      animations: "disabled",
      path: path.join(
        process.env.CHATGPT_WIDGET_CAPTURE_DIR,
        `${testInfo.project.name}.png`,
      ),
    });
  }
  await page.evaluate(() =>
    document.querySelector("iframe")!.contentWindow!.postMessage(
      {
        jsonrpc: "2.0",
        method: "ui/notifications/host-context-changed",
        params: { theme: "dark" },
      },
      window.location.origin,
    ),
  );
  await expect(app.locator("html")).toHaveClass(/dark/);
  expect(
    await app
      .locator("html")
      .evaluate((element) => element.scrollWidth <= window.innerWidth),
  ).toBe(true);
  await app
    .getByRole("button", { name: "Continue on website", exact: true })
    .click();
  await expect(
    app.getByText(
      "The website could not be opened. Your preview is still here; try again.",
    ),
  ).toBeVisible();
  await expect(app.getByText("2 selected", { exact: true })).toBeVisible();
  await app
    .getByRole("button", { name: "Continue on website", exact: true })
    .click();
  await expect(page.locator("body")).toHaveAttribute(
    "data-website-opened",
    "true",
  );
  await expect(app.getByText("2 selected", { exact: true })).toBeVisible();
  await app.getByRole("button", { name: "Continue to save" }).click();
  await expect(
    app.getByRole("heading", { name: "Choose a Project" }),
  ).toBeVisible();
  await expect(
    app.getByRole("button", { name: "Import testimonials", exact: true }),
  ).toHaveCount(0);
  await app.getByRole("button", { name: "Juniper Studio" }).click();
  await expect(
    app.getByText(
      "1 of 2 video storage places available across your account. Capacity is checked again when you import.",
      { exact: true },
    ),
  ).toBeVisible();
  if (process.env.CHATGPT_WIDGET_CAPTURE_DIR) {
    await page.screenshot({
      animations: "disabled",
      path: path.join(
        process.env.CHATGPT_WIDGET_CAPTURE_DIR,
        `${testInfo.project.name}-project-dark.png`,
      ),
    });
    await page.evaluate(() =>
      document.querySelector("iframe")!.contentWindow!.postMessage(
        {
          jsonrpc: "2.0",
          method: "ui/notifications/host-context-changed",
          params: { theme: "light" },
        },
        window.location.origin,
      ),
    );
    await expect(app.locator("html")).not.toHaveClass(/dark/);
    await page.waitForTimeout(250);
    await page.screenshot({
      animations: "disabled",
      path: path.join(
        process.env.CHATGPT_WIDGET_CAPTURE_DIR,
        `${testInfo.project.name}-project-light.png`,
      ),
    });
  }
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await app
    .getByRole("button", { name: "Import testimonials", exact: true })
    .click();
  await expect(
    app.getByRole("heading", { name: "Your testimonials are in" }),
  ).toBeVisible();
  await expect(
    app.getByText(
      "Imported testimonials are Pending. Nothing has been published.",
    ),
  ).toBeVisible();
  await expect(app.getByRole("button", { name: "Open Inbox" })).toBeVisible();
  if (process.env.CHATGPT_WIDGET_CAPTURE_DIR) {
    await page.screenshot({
      animations: "disabled",
      path: path.join(
        process.env.CHATGPT_WIDGET_CAPTURE_DIR,
        `${testInfo.project.name}-saved.png`,
      ),
    });
  }
});
