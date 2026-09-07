import { describe, expect, it } from "vitest";

import {
  accentPresets,
  defaultAccent,
  isHexColor,
  isWallTheme,
  publicTemplates,
  templateBySlug,
  templateCategoryKeys,
  templates,
} from "@/lib/templates-catalog";

describe("templates catalog", () => {
  it("uses unique slugs that match their component file", () => {
    const slugs = templates.map((template) => template.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const template of templates) {
      expect(template.slug).toMatch(/^[a-z0-9-]+$/);
      expect(template.file).toBe(
        `src/components/templates/${template.slug}.tsx`,
      );
      expect(templateCategoryKeys).toContain(template.category);
      expect(template.description.endsWith(".")).toBe(true);
    }
  });

  it("keeps drafts out of the public list", () => {
    expect(publicTemplates.length).toBeGreaterThan(0);
    expect(
      publicTemplates.every((template) => template.status === "public"),
    ).toBe(true);
    expect(templates.some((template) => template.status === "draft")).toBe(
      true,
    );
    expect(publicTemplates.map((template) => template.slug)).not.toContain(
      "proof-strip",
    );
  });

  it("covers every family with at least one public template", () => {
    for (const category of templateCategoryKeys) {
      expect(
        publicTemplates.some((template) => template.category === category),
      ).toBe(true);
    }
  });

  it("finds a template by slug", () => {
    expect(templateBySlug("masonry-wall")?.name).toBe("Masonry wall");
    expect(templateBySlug("nope")).toBeUndefined();
  });

  it("validates accents and wall themes from the URL", () => {
    expect(isHexColor(defaultAccent)).toBe(true);
    expect(accentPresets.every((preset) => isHexColor(preset.value))).toBe(
      true,
    );
    expect(isHexColor("#12345")).toBe(false);
    expect(isHexColor("red")).toBe(false);
    expect(isWallTheme("dark")).toBe(true);
    expect(isWallTheme("system")).toBe(false);
  });
});
