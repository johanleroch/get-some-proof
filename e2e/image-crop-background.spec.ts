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

for (const format of ["png", "svg"] as const) {
  test(`transparent ${format} exports with a white background and keeps logo colors`, async ({
    page,
  }) => {
    await page.goto("/sign-in");
    await page.addScriptTag({ content: cropCode });
    const pixels = await page.evaluate(async (format) => {
      let source: string;
      if (format === "svg") {
        source = URL.createObjectURL(
          new Blob(
            [
              '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect x="8" y="8" width="16" height="16" fill="red"/></svg>',
            ],
            { type: "image/svg+xml" },
          ),
        );
      } else {
        const input = document.createElement("canvas");
        input.width = input.height = 32;
        const ctx = input.getContext("2d")!;
        ctx.fillStyle = "red";
        ctx.fillRect(8, 8, 16, 16);
        source = input.toDataURL("image/png");
      }
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
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(result, 0, 0);
      URL.revokeObjectURL(source);
      result.close();
      return {
        type: blob.type,
        corner: [...ctx.getImageData(4, 4, 1, 1).data],
        center: [...ctx.getImageData(256, 256, 1, 1).data],
      };
    }, format);
    expect(pixels.type).toBe("image/jpeg");
    expect(pixels.corner.every((channel) => channel >= 250)).toBe(true);
    expect(pixels.center[0]).toBeGreaterThan(245);
    expect(pixels.center[1]).toBeLessThan(10);
    expect(pixels.center[2]).toBeLessThan(10);
  });
}
