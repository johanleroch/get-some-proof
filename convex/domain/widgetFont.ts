import { ConvexError } from "convex/values";

export const MAX_WIDGET_FONT_BYTES = 500 * 1024;
export const MAX_PROJECT_FONTS = 5;

export function validateWidgetFont(bytes: ArrayBuffer, name: string) {
  const label = name.trim();
  if (!label || label.length > 80)
    throw new ConvexError({
      code: "INVALID_FONT",
      message: "Name your font using 1–80 characters.",
    });
  if (bytes.byteLength < 48 || bytes.byteLength > MAX_WIDGET_FONT_BYTES)
    throw new ConvexError({
      code: "INVALID_FONT",
      message: "Choose a WOFF2 font under 500 KB.",
    });
  const view = new DataView(bytes);
  if (
    view.getUint32(0) !== 0x774f4632 ||
    ![0x00010000, 0x4f54544f].includes(view.getUint32(4)) ||
    view.getUint32(8) !== bytes.byteLength ||
    view.getUint16(12) === 0 ||
    view.getUint16(12) > 128 ||
    view.getUint16(14) !== 0 ||
    view.getUint32(16) > 10 * 1024 * 1024 ||
    view.getUint32(20) > bytes.byteLength - 48
  )
    throw new ConvexError({
      code: "INVALID_FONT",
      message: "This file is not a supported WOFF2 font.",
    });
  return label;
}
