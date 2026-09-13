import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CodeInput } from "@/components/ui/code-input";

function renderCode(onComplete = vi.fn()) {
  render(
    <form aria-label="Verification">
      <label htmlFor="code">Code</label>
      <CodeInput id="code" name="code" onComplete={onComplete} />
    </form>,
  );
  return {
    boxes: Array.from({ length: 6 }, (_, index) =>
      screen.getByLabelText(`Digit ${index + 1} of 6`),
    ),
    onComplete,
    form: () => new FormData(screen.getByRole("form") as HTMLFormElement),
  };
}

describe("CodeInput", () => {
  afterEach(cleanup);

  it("moves to the next box as digits land and reports the finished code", () => {
    const { boxes, form, onComplete } = renderCode();
    expect(boxes[0]).toHaveAttribute("id", "code");

    "12345".split("").forEach((digit, index) => {
      fireEvent.change(boxes[index], { target: { value: digit } });
      expect(boxes[index + 1]).toHaveFocus();
    });
    expect(onComplete).not.toHaveBeenCalled();

    fireEvent.change(boxes[5], { target: { value: "6" } });
    expect(onComplete).toHaveBeenCalledExactlyOnceWith("123456");
    expect(form().get("code")).toBe("123456");
  });

  it("spreads a pasted code across every box", () => {
    const { boxes, form, onComplete } = renderCode();
    fireEvent.paste(boxes[0], {
      clipboardData: { getData: () => "123 456" },
    });
    expect(boxes.map((box) => (box as HTMLInputElement).value)).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
    ]);
    expect(form().get("code")).toBe("123456");
    expect(onComplete).toHaveBeenCalledExactlyOnceWith("123456");
  });

  it("keeps the extra keystrokes of a fast typist", () => {
    const { boxes, form } = renderCode();
    // The focus has not moved yet, so the next digits still reach this box.
    fireEvent.change(boxes[0], { target: { value: "48" } });
    expect(boxes[0]).toHaveValue("4");
    expect(boxes[1]).toHaveValue("8");
    expect(boxes[2]).toHaveFocus();
    expect(form().get("code")).toBe("48");
  });

  it("changes only the box being edited, not the one after it", () => {
    const { boxes, form } = renderCode();
    fireEvent.paste(boxes[0], { clipboardData: { getData: () => "123456" } });
    // A caret placed after the existing digit, so the box reports both.
    fireEvent.change(boxes[2], { target: { value: "39" } });
    expect(boxes[2]).toHaveValue("9");
    expect(boxes[3]).toHaveValue("4");
    expect(form().get("code")).toBe("129456");
  });

  it("leaves a digitless paste alone instead of clearing the box", () => {
    const { boxes, form } = renderCode();
    fireEvent.paste(boxes[0], { clipboardData: { getData: () => "123456" } });
    fireEvent.paste(boxes[2], {
      clipboardData: { getData: () => "Get Some Proof" },
    });
    expect(boxes[2]).toHaveValue("3");
    expect(form().get("code")).toBe("123456");
  });

  it("offers a completion again once the boxes come back from disabled", () => {
    const onComplete = vi.fn();
    const { rerender } = render(
      <CodeInput disabled id="code" name="code" onComplete={onComplete} />,
    );
    fireEvent.paste(screen.getByLabelText("Digit 1 of 6"), {
      clipboardData: { getData: () => "123456" },
    });
    expect(onComplete).not.toHaveBeenCalled();

    rerender(<CodeInput id="code" name="code" onComplete={onComplete} />);
    expect(onComplete).toHaveBeenCalledExactlyOnceWith("123456");
  });

  it("ignores anything that is not a digit", () => {
    const { boxes, form } = renderCode();
    fireEvent.change(boxes[0], { target: { value: "a" } });
    expect(boxes[0]).toHaveValue("");
    expect(form().get("code")).toBe("");
  });

  it("sends a backspace in an empty box to the digit before it", () => {
    const { boxes } = renderCode();
    fireEvent.change(boxes[0], { target: { value: "7" } });
    fireEvent.keyDown(boxes[1], { key: "Backspace" });
    expect(boxes[0]).toHaveValue("");
    expect(boxes[0]).toHaveFocus();
  });

  it("walks the boxes with the arrow keys", () => {
    const { boxes } = renderCode();
    fireEvent.keyDown(boxes[0], { key: "ArrowRight" });
    expect(boxes[1]).toHaveFocus();
    fireEvent.keyDown(boxes[1], { key: "ArrowLeft" });
    expect(boxes[0]).toHaveFocus();
    fireEvent.keyDown(boxes[0], { key: "End" });
    expect(boxes[5]).toHaveFocus();
    fireEvent.keyDown(boxes[5], { key: "Home" });
    expect(boxes[0]).toHaveFocus();
  });

  it("asks again once a refused code is corrected", () => {
    const { boxes, onComplete } = renderCode();
    fireEvent.paste(boxes[0], { clipboardData: { getData: () => "111111" } });
    expect(onComplete).toHaveBeenCalledTimes(1);
    // Retyping the same digits must not fire a second time on its own.
    fireEvent.change(boxes[5], { target: { value: "1" } });
    expect(onComplete).toHaveBeenCalledTimes(1);
    fireEvent.change(boxes[5], { target: { value: "2" } });
    expect(onComplete).toHaveBeenLastCalledWith("111112");
    expect(onComplete).toHaveBeenCalledTimes(2);
  });
});
