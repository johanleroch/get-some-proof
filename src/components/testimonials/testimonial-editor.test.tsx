import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TestimonialEditor } from "./testimonial-editor";

afterEach(cleanup);

describe("TestimonialEditor read-only keyboard behavior", () => {
  it("prevents backward navigation in marking mode", () => {
    render(
      <TestimonialEditor
        formatOnly
        id="quote"
        text="Customer words"
        onChange={vi.fn()}
      />,
    );
    const editor = screen.getByLabelText("Your testimonial");
    expect(editor).toHaveAttribute("contenteditable", "false");
    expect(editor).toHaveAttribute("tabindex", "0");
    expect(fireEvent.keyDown(editor, { key: "Backspace" })).toBe(false);
    expect(fireEvent.keyDown(editor, { key: "Delete" })).toBe(false);
  });

  it("freezes content and consumes the highlight shortcut while saving", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <TestimonialEditor
        id="quote"
        text="Customer words"
        onChange={onChange}
      />,
    );
    rerender(
      <TestimonialEditor
        disabled
        id="quote"
        text="Customer words"
        onChange={onChange}
      />,
    );
    const editor = screen.getByLabelText("Your testimonial");
    expect(editor).toHaveAttribute("contenteditable", "false");
    expect(editor).toHaveAttribute("aria-readonly", "true");
    expect(
      fireEvent.keyDown(editor, { key: "h", ctrlKey: true, shiftKey: true }),
    ).toBe(false);
    expect(editor).toHaveTextContent("Customer words");
    expect(onChange).not.toHaveBeenCalled();
  });
});
