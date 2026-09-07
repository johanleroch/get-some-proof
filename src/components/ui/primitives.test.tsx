import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Sparkle } from "@/components/doodles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, FieldError } from "@/components/ui/field";
import { PageHeader } from "@/components/page-header";

describe("design primitives", () => {
  afterEach(cleanup);

  it("keeps the label in the tree and blocks input while a button loads", () => {
    render(<Button loading>Save settings</Button>);
    const button = screen.getByRole("button", { name: "Save settings" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("data-loading", "true");
  });

  it("renders tonal badges with an optional status dot", () => {
    const { container } = render(
      <Badge dot variant="success">
        Published
      </Badge>,
    );
    expect(screen.getByText("Published")).toHaveAttribute(
      "data-variant",
      "success",
    );
    expect(container.querySelectorAll("span[aria-hidden]")).toHaveLength(1);
  });

  it("composes an empty state with illustration, copy and one action", () => {
    const { container } = render(
      <EmptyState
        action={<Button>Copy collection link</Button>}
        description="Share your Collection Form."
        illustration={<Sparkle />}
        title="No Testimonials yet"
      />,
    );
    expect(
      screen.getByRole("heading", { name: "No Testimonials yet" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copy collection link" }),
    ).toBeInTheDocument();
    expect(container.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("announces field errors and hides empty ones", () => {
    const { rerender } = render(
      <Field>
        <FieldError>Enter a full email address.</FieldError>
      </Field>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a full email address.",
    );
    rerender(
      <Field>
        <FieldError>{null}</FieldError>
      </Field>,
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("renders the page header pattern with one action", () => {
    render(
      <PageHeader
        actions={<Button>Copy collection link</Button>}
        description="Review proof privately."
        eyebrow="Workspace"
        title="Northwind Bakery"
      />,
    );
    expect(screen.getByText("Workspace")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Northwind Bakery" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copy collection link" }),
    ).toBeInTheDocument();
  });
});
