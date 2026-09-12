"use client";
import { useEffect, useRef } from "react";
import { blobToast } from "@/components/brand/blob-toast";
import {
  widgetPayload,
  type WidgetPayload,
  type WidgetPresentation,
} from "./widget-payload";

type Runtime = {
  renderWidget: (host: HTMLElement, payload: WidgetPayload) => void;
};
declare global {
  interface Window {
    __getSomeProofEmbedV2?: Runtime;
  }
}
let loading: Promise<void> | undefined;
function loadRuntime() {
  if (window.__getSomeProofEmbedV2) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/embed/v2.js";
    script.onload = () => resolve();
    script.onerror = () => {
      loading = undefined;
      script.remove();
      reject(new Error("Preview unavailable"));
    };
    document.head.append(script);
  });
  return loading;
}
export function WidgetPreview({ value }: { value: WidgetPresentation }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    void loadRuntime()
      .then(() => {
        if (!cancelled && host.current)
          window.__getSomeProofEmbedV2?.renderWidget(
            host.current,
            widgetPayload(value),
          );
      })
      .catch(() => {
        if (!cancelled)
          blobToast.error(
            "Preview unavailable. Reload this page to try again.",
            { id: "widget-preview-error" },
          );
      });
    return () => {
      cancelled = true;
    };
  }, [value]);
  return <div ref={host} data-widget-preview="" />;
}
