import type { ComponentProps } from "react";

// The MCP document has no Next router; navigation uses the browser.
export default function BrowserLink(props: ComponentProps<"a">) {
  return <a {...props} />;
}
