import { expect, test } from "@playwright/test";

const token = "d".repeat(64);
const key = "gsp-wall-import-preview";

test("transfers the preview before loading the site, stripping its fragment and referrer", async ({
  page,
}) => {
  const requests: { url: string; referer?: string }[] = [];
  page.on("request", (request) =>
    requests.push({ url: request.url(), referer: request.headers().referer }),
  );
  await page.route(/\/import(?:\?.*)?$/, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html lang="en"><body>Continuation target</body></html>',
    }),
  );
  await page.goto(`/import/continue#preview=${token}`);
  await expect(page).toHaveURL(/\/import$/);
  expect(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), key),
  ).toEqual({ token, resume: true });
  expect(
    requests.every(
      (request) =>
        !request.url.includes(token) && !request.referer?.includes(token),
    ),
  ).toBe(true);
  await page.reload();
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).token,
      key,
    ),
  ).toBe(token);
});

test("rejects malformed handoffs without replacing an existing preview", async ({
  page,
}) => {
  await page.addInitScript(
    ({ key, token }) =>
      localStorage.setItem(key, JSON.stringify({ token, resume: false })),
    { key, token },
  );
  await page.route(/\/import(?:\?.*)?$/, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html lang="en"><body>Continuation target</body></html>',
    }),
  );
  await page.goto(
    "/import/continue#preview=invalid&next=https://untrusted.example",
  );
  await expect(page).toHaveURL(/\/import\?handoff=failed$/);
  expect(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), key),
  ).toEqual({ token, resume: false });
});

test("reports blocked browser storage without leaking the preview into the destination URL", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error("Storage unavailable");
    };
  });
  await page.route(/\/import(?:\?.*)?$/, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html lang="en"><body>Continuation target</body></html>',
    }),
  );
  await page.goto(`/import/continue#preview=${token}`);
  await expect(page).toHaveURL(/\/import\?handoff=failed$/);
  expect(page.url()).not.toContain(token);
});
