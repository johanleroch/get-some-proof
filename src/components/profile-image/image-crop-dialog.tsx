"use client";

import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

async function loadImage(source: string) {
  const image = new Image();
  image.src = source;
  await image.decode();
  return image;
}

export async function cropImage(source: string, area: Area) {
  const image = await loadImage(source);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context)
    throw new Error("Image editing is unavailable in this browser.");

  canvas.width = 512;
  canvas.height = 512;
  context.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    512,
    512,
  );

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("Unable to prepare the image.")),
      "image/jpeg",
      0.9,
    );
  });
}

export function ImageCropDialog({
  busy,
  cropShape,
  onCancel,
  onConfirm,
  source,
  title,
}: {
  busy: boolean;
  cropShape: "round" | "rect";
  onCancel: () => void;
  onConfirm: (blob: Blob) => Promise<void>;
  source: string | null;
  title: string;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const onCropComplete = useCallback(
    (_croppedArea: Area, croppedAreaPixels: Area) => setArea(croppedAreaPixels),
    [],
  );

  async function confirm() {
    if (!source || !area) return;
    await onConfirm(await cropImage(source, area));
  }

  return (
    <Dialog open={Boolean(source)} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-xl p-0" showCloseButton={!busy}>
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Drag to reposition your image, then adjust the zoom.
          </DialogDescription>
        </DialogHeader>
        <div className="bg-muted relative mx-6 h-72 overflow-hidden rounded-lg sm:h-80">
          {source ? (
            <Cropper
              aspect={1}
              crop={crop}
              cropShape={cropShape}
              image={source}
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
              roundCropAreaPixels
              showGrid={cropShape === "rect"}
              zoom={zoom}
            />
          ) : null}
        </div>
        <div className="space-y-2 px-6">
          <div className="flex items-center justify-between">
            <Label htmlFor="profile-image-zoom">Zoom</Label>
            <span className="text-muted-foreground text-xs">
              {Math.round(zoom * 100)}%
            </span>
          </div>
          <input
            aria-label="Zoom image"
            className="accent-primary w-full"
            disabled={busy}
            id="profile-image-zoom"
            max="3"
            min="1"
            onChange={(event) => setZoom(Number(event.target.value))}
            step="0.01"
            type="range"
            value={zoom}
          />
        </div>
        <DialogFooter className="border-t px-6 py-4">
          <Button
            disabled={busy}
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={busy || !area}
            onClick={() => void confirm()}
            type="button"
          >
            {busy ? "Uploading…" : "Set new picture"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
