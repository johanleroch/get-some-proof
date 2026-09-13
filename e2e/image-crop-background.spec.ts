import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import ts from "typescript";

// Exercise the actual crop/export functions in a browser with a real canvas.
const source = ts.createSourceFile(
  "image-crop-dialog.tsx",
  readFileSync("src/components/profile-image/image-crop-dialog.tsx", "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const cropCode = ts.transpileModule(
  source.statements
    .filter(
      (node) =>
        ts.isFunctionDeclaration(node) &&
        ["loadImage", "cropImage"].includes(node.name?.text ?? ""),
    )
    .map((node) => node.getText(source).replace(/^export /, ""))
    .join("\n"),
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
).outputText;

test("a transparent portrait crop preserves alpha with WebP or the browser PNG fallback", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.addScriptTag({ content: cropCode });
  const pixels = await page.evaluate(async () => {
    const input = document.createElement("canvas");
    input.width = input.height = 32;
    const ctx = input.getContext("2d")!;
    ctx.fillStyle = "red";
    ctx.fillRect(8, 8, 16, 16);
    const source = input.toDataURL("image/png");
    const crop = (
      window as unknown as {
        cropImage: (
          source: string,
          area: { x: number; y: number; width: number; height: number },
        ) => Promise<Blob>;
      }
    ).cropImage;
    const blob = await crop(source, { x: 0, y: 0, width: 32, height: 32 });
    const result = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    const outputContext = canvas.getContext("2d")!;
    outputContext.drawImage(result, 0, 0);
    URL.revokeObjectURL(source);
    result.close();
    return {
      // Unsupported canvas formats fall back to PNG per the browser API.
      supportsWebP: input.toDataURL("image/webp").startsWith("data:image/webp"),
      type: blob.type,
      corner: [...outputContext.getImageData(4, 4, 1, 1).data],
      center: [...outputContext.getImageData(256, 256, 1, 1).data],
    };
  });
  expect(pixels.type).toBe(pixels.supportsWebP ? "image/webp" : "image/png");
  expect(pixels.corner[3]).toBe(0);
  expect(pixels.center[0]).toBeGreaterThan(245);
  expect(pixels.center[1]).toBeLessThan(10);
  expect(pixels.center[2]).toBeLessThan(10);
  expect(pixels.center[3]).toBe(255);
});
