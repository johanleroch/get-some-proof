import type { Page } from "@playwright/test";

// A synthetic camera with real browser tracks and encoding, without hardware access.
export async function installRecorderCamera(
  page: Page,
  width: number,
  height: number,
) {
  await page.addInitScript(
    ({ width, height }) => {
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          enumerateDevices: async () => [],
          getUserMedia: async () => {
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext("2d")!;
            const draw = () => {
              context.fillStyle = "#345d51";
              context.fillRect(0, 0, width, height);
              context.strokeStyle = "#ffbb16";
              context.lineWidth = 20;
              context.strokeRect(10, 10, width - 20, height - 20);
              context.fillStyle = "#fcfaf5";
              context.font = "40px sans-serif";
              context.fillText(`${width} × ${height}`, 50, 80);
            };
            draw();
            const stream = canvas.captureStream(15);
            const timer = window.setInterval(draw, 60);
            stream
              .getVideoTracks()[0]
              .addEventListener("ended", () => clearInterval(timer));
            return stream;
          },
        },
      });
    },
    { width, height },
  );
}
