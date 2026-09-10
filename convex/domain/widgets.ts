import { ConvexError, type Infer, v } from "convex/values";

export const widgetLayoutValidator = v.union(
  v.literal("wall"),
  v.literal("individual"),
  v.literal("carousel"),
  v.literal("masonry"),
  v.literal("highlights"),
  v.literal("avatars"),
);
export const widgetConfigValidator = v.object({
  layout: widgetLayoutValidator,
  font: v.union(
    v.literal("inherit"),
    v.literal("sans"),
    v.literal("serif"),
    v.literal("mono"),
  ),
  accentColor: v.string(),
  backgroundColor: v.string(),
  textColor: v.string(),
});
export const widgetSnapshotValidator = v.object({
  config: widgetConfigValidator,
  testimonialIds: v.array(v.id("testimonials")),
});
export type WidgetConfig = Infer<typeof widgetConfigValidator>;
export type WidgetLayout = WidgetConfig["layout"];
export const MAX_WIDGETS = 100;
export const MAX_WIDGET_TESTIMONIALS = 50;
export function invalidWidget(message: string): never {
  throw new ConvexError({ code: "INVALID_WIDGET", message });
}
export function normalizeWidgetConfig(config: WidgetConfig): WidgetConfig {
  const color = (value: string) => {
    if (!/^#[0-9a-fA-F]{6}$/.test(value))
      invalidWidget("Choose a six-digit hex color.");
    return value.toLowerCase();
  };
  return {
    ...config,
    accentColor: color(config.accentColor),
    backgroundColor: color(config.backgroundColor),
    textColor: color(config.textColor),
  };
}
export function normalizeWidgetName(name: string) {
  const value = name.trim();
  if (!value || value.length > 80)
    invalidWidget("Name your widget using 1–80 characters.");
  return value;
}
