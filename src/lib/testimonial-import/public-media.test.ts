// @vitest-environment node
import { expect, it } from "vitest";
import { downloadPublicPortrait } from "./public-media";

it.each([
  "http://127.0.0.1/photo.png",
  "http://10.0.0.1/photo.png",
  "http://169.254.169.254/latest/meta-data",
  "http://[::1]/photo.png",
  "http://[::ffff:127.0.0.1]/photo.png",
  "http://2130706433/photo.png",
  "http://localhost/photo.png",
  "https://user:password@example.com/photo.png",
  "file:///tmp/photo.png",
  "http://192.168.1.10/photo.png",
  "http://100.64.0.1/photo.png",
  "http://[2002:7f00:1::]/photo.png",
])("rejects unsafe portrait source %s before copying", async (url) => {
  await expect(downloadPublicPortrait(url)).rejects.toThrow();
});
