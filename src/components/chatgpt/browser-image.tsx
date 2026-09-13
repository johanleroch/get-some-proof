import type { ComponentProps } from "react";

// Assets in the standalone MCP document do not use the Next image service.
export default function BrowserImage({ alt, ...props }: ComponentProps<"img">) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...props} alt={alt} />;
}
