import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { addressSegments, PublicAddress } from "./public-address";

describe("PublicAddress", () => {
  afterEach(cleanup);

  it("cuts after every slash and keeps each piece whole", () => {
    expect(
      addressSegments("https://getsomeproof.com/c/fernhill-studio"),
    ).toEqual(["https://", "getsomeproof.com/", "c/", "fernhill-studio"]);
    const { container } = render(
      <PublicAddress url="https://getsomeproof.com/c/fernhill-studio" />,
    );
    expect(container.querySelectorAll("wbr")).toHaveLength(3);
    const pieces = [...container.querySelectorAll("span")];
    expect(pieces.map((piece) => piece.textContent)).toEqual([
      "https://",
      "getsomeproof.com/",
      "c/",
      "fernhill-studio",
    ]);
    for (const piece of pieces) expect(piece).toHaveClass("whitespace-nowrap");
    expect(container.textContent).toBe(
      "https://getsomeproof.com/c/fernhill-studio",
    );
  });

  it("lets only an oversized piece break inside", () => {
    const { container } = render(
      <PublicAddress url="https://getsomeproof.com/c/a-public-address-longer-than-any-phone-line" />,
    );
    const last = [...container.querySelectorAll("span")].at(-1);
    expect(last).toHaveClass("[overflow-wrap:anywhere]");
  });
});
