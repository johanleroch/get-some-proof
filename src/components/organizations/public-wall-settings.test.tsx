import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PublicWallSettings } from "./public-wall-settings";

const settings = {
  accentColor: "#123abc",
  canHideAttribution: false,
  hideAttribution: false,
  theme: "system" as const,
  transparentEmbed: false,
  visibility: { avatar: true, company: true, rating: true, role: true },
};

describe("PublicWallSettings", () => {
  it("saves theme, accent, embed and global visibility while keeping name mandatory", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<PublicWallSettings onSave={onSave} settings={settings} />);

    fireEvent.change(screen.getByLabelText("Theme"), {
      target: { value: "dark" },
    });
    fireEvent.change(screen.getByLabelText("Accent color"), {
      target: { value: "#f97316" },
    });
    fireEvent.click(
      screen.getByLabelText("Use a transparent Embedded Wall background"),
    );
    fireEvent.click(screen.getByLabelText("Stars"));
    fireEvent.click(screen.getByRole("button", { name: "Save Public Wall" }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        accentColor: "#f97316",
        hideAttribution: false,
        theme: "dark",
        transparentEmbed: true,
        visibility: { avatar: true, company: true, rating: false, role: true },
      }),
    );
    expect(screen.queryByLabelText(/name/i)).toBeNull();
    expect(screen.getByLabelText(/Hide the Attribution Badge/)).toBeDisabled();
  });
});
