import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ColorPicker } from "./color-picker";

function Picker() {
  const [value, setValue] = useState("#ff0000");
  return (
    <ColorPicker
      legend="Brand color"
      onChange={setValue}
      presets={[{ label: "Red", value: "#ff0000" }]}
      value={value}
    />
  );
}

afterEach(cleanup);

describe("ColorPicker accessible color axes", () => {
  it("names each range and exposes its current percentage", () => {
    render(<Picker />);
    fireEvent.click(screen.getByRole("button", { name: "Custom color" }));

    for (const name of ["Saturation", "Brightness"]) {
      const slider = screen.getByRole("slider", { name });
      expect(slider).toHaveAttribute("min", "0");
      expect(slider).toHaveAttribute("max", "100");
      expect(slider).toHaveValue("100");
      expect(slider).toHaveAttribute("aria-valuetext", "100%");
    }
    expect(screen.getAllByRole("slider")).toHaveLength(3);
  });

  it("updates saturation and brightness independently and synchronizes the hex field", () => {
    render(<Picker />);
    fireEvent.click(screen.getByRole("button", { name: "Custom color" }));

    fireEvent.change(screen.getByRole("slider", { name: "Saturation" }), {
      target: { value: "0" },
    });
    expect(screen.getByRole("textbox", { name: "Hex" })).toHaveValue("#ffffff");
    expect(screen.getByRole("slider", { name: "Brightness" })).toHaveValue(
      "100",
    );

    fireEvent.change(screen.getByRole("slider", { name: "Brightness" }), {
      target: { value: "50" },
    });
    expect(screen.getByRole("textbox", { name: "Hex" })).toHaveValue("#808080");
    expect(screen.getByRole("slider", { name: "Brightness" })).toHaveAttribute(
      "aria-valuetext",
      "50%",
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Hex" }), {
      target: { value: "#00ff00" },
    });
    expect(screen.getByRole("slider", { name: "Saturation" })).toHaveValue(
      "100",
    );
    expect(screen.getByRole("slider", { name: "Brightness" })).toHaveValue(
      "100",
    );
    expect(screen.getByRole("slider", { name: "Hue" })).toHaveValue("120");
  });
});
