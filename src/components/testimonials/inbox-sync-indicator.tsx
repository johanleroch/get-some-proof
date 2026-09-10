"use client";

import { useEffect, useState } from "react";
import { useConvexConnectionState } from "convex/react";

import { BlobLoader } from "@/components/brand/blob-loader";

function DelayedIndicator({ label }: { label: string }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(timer);
  }, []);
  return visible ? <BlobLoader label={label} size={16} /> : null;
}

export function InboxSyncIndicator({ updating }: { updating: boolean }) {
  const { isWebSocketConnected } = useConvexConnectionState();
  if (!isWebSocketConnected) {
    return <DelayedIndicator label="Reconnecting to live testimonials" />;
  }
  return updating ? <DelayedIndicator label="Updating testimonials" /> : null;
}
