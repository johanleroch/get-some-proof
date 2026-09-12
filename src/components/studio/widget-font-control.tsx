"use client";
import { useRef, useState } from "react";
import { ConvexError } from "convex/values";
import type { Id } from "@convex/_generated/dataModel";
import type { WidgetConfig } from "@convex/domain/widgets";
import { MAX_WIDGET_FONT_BYTES } from "@convex/domain/widgetFont";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GoogleFontPicker } from "./google-font-picker";
import { ErrorToast } from "@/components/ui/error-toast";
import type { StudioViewProps } from "./studio-view";

export function WidgetFontControl({
  config,
  onChange,
  library,
  onUpload,
  onRemove,
}: {
  config: WidgetConfig;
  onChange: (config: Partial<WidgetConfig>) => void;
  library: StudioViewProps["fontLibrary"];
  onUpload: StudioViewProps["onUploadFont"];
  onRemove: StudioViewProps["onRemoveFont"];
}) {
  const [source, setSource] = useState<"custom" | "google" | null>(
    config.customFontId ? "custom" : config.googleFont ? "google" : null,
  );
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function upload(file: File) {
    if (!onUpload) return;
    setPending(true);
    setError(null);
    try {
      if (!/\.woff2$/i.test(file.name) || file.size > MAX_WIDGET_FONT_BYTES)
        throw new Error("Choose a WOFF2 font under 500 KB.");
      // Decode before upload so corrupt font files never become selectable.
      await new FontFace("gsp-upload-check", await file.arrayBuffer()).load();
      const id = await onUpload(file);
      onChange({
        customFontId: id as Id<"widgetFonts">,
        googleFont: undefined,
      });
    } catch (cause) {
      const data = cause instanceof ConvexError ? cause.data : null;
      setError(
        data && typeof data === "object" && typeof data.message === "string"
          ? data.message
          : cause instanceof Error && cause.name !== "SyntaxError"
            ? cause.message
            : "This font could not be read. Choose a valid WOFF2 file.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="space-y-3">
      <Label htmlFor="widget-font">Font</Label>
      <Select
        value={source ?? config.font}
        onValueChange={(value) => {
          if (value === "custom" || value === "google") {
            setSource(value);
            onChange(
              value === "custom"
                ? { googleFont: undefined }
                : { customFontId: undefined },
            );
          } else {
            setSource(null);
            onChange({
              font: value as WidgetConfig["font"],
              customFontId: undefined,
              googleFont: undefined,
            });
          }
        }}
      >
        <SelectTrigger id="widget-font" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="inherit">Match your website</SelectItem>
          <SelectItem value="sans">Sans serif</SelectItem>
          <SelectItem value="serif">Serif</SelectItem>
          <SelectItem value="mono">Monospace</SelectItem>
          <SelectItem value="google" disabled={!library?.canUpload}>
            Google Fonts{!library?.canUpload ? " · Pro" : ""}
          </SelectItem>
          <SelectItem value="custom" disabled={!library?.canUpload}>
            Custom font{!library?.canUpload ? " · Pro" : ""}
          </SelectItem>
        </SelectContent>
      </Select>
      {!source && config.font === "inherit" ? (
        <p className="type-small text-ink-2">
          Uses the font of the page where you embed this widget.
        </p>
      ) : null}
      {source === "google" && library?.canUpload ? (
        <GoogleFontPicker
          value={config.googleFont}
          onChange={(googleFont) =>
            onChange({ googleFont, customFontId: undefined })
          }
        />
      ) : null}
      {source === "custom" && !!library?.fonts.length ? (
        <Select
          value={config.customFontId ?? ""}
          onValueChange={(value) =>
            onChange({
              customFontId: value as Id<"widgetFonts">,
              googleFont: undefined,
            })
          }
        >
          <SelectTrigger aria-label="Custom font" className="w-full">
            <SelectValue placeholder="Choose an uploaded font" />
          </SelectTrigger>
          <SelectContent>
            {library.fonts.map((font) => (
              <SelectItem
                key={font.id}
                value={font.id}
                disabled={!library.canUpload}
              >
                {font.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      {source === "custom" && library?.canUpload ? (
        <>
          <input
            ref={input}
            type="file"
            accept=".woff2,font/woff2"
            className="sr-only"
            aria-label="Upload custom font"
            disabled={pending || !onUpload}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void upload(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            loading={pending}
            disabled={!onUpload || library.fonts.length >= 5}
            onClick={() => input.current?.click()}
          >
            Upload font
          </Button>
          <p className="type-small text-ink-2">
            WOFF2, up to 500 KB. Available across this project’s widgets.
          </p>
        </>
      ) : null}
      {source === "custom" && !!library?.fonts.length && onRemove ? (
        <div className="space-y-2">
          {library.fonts.map((font) => (
            <div
              key={font.id}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="min-w-0 truncate">{font.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                aria-label={`Remove ${font.name}`}
                onClick={async () => {
                  setPending(true);
                  setError(null);
                  try {
                    await onRemove(font.id);
                    if (config.customFontId === font.id)
                      onChange({ customFontId: undefined });
                  } catch (cause) {
                    const data =
                      cause instanceof ConvexError ? cause.data : null;
                    setError(
                      data &&
                        typeof data === "object" &&
                        typeof data.message === "string"
                        ? data.message
                        : "Unable to remove this font.",
                    );
                  } finally {
                    setPending(false);
                  }
                }}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      ) : null}
      {error ? <ErrorToast message={error} /> : null}
    </div>
  );
}
