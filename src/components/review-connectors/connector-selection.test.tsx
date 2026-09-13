import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { TestimonialImportView } from "../testimonials/testimonial-import-view";

afterEach(cleanup);

it("selects registered providers without hard-coded Google branches and returns to imports", () => {
  render(
    <TestimonialImportView
      slug="willow-ceramics"
      jobId={null}
      provider="senja"
      setProvider={vi.fn()}
      url=""
      setUrl={vi.fn()}
      loading={false}
      saving={false}
      error=""
      result={null}
      preview={undefined}
      selected={new Set()}
      cursors={[null]}
      setCursors={vi.fn()}
      changeSelection={vi.fn()}
      backToUrl={vi.fn()}
      read={vi.fn()}
      save={vi.fn()}
      initialConnector="provider-two"
      connectors={[
        {
          id: "provider-one",
          label: "First review provider",
          content: <p>First provider connection</p>,
        },
        {
          id: "provider-two",
          label: "Second review provider",
          content: <p>Second provider connection</p>,
        },
        {
          id: "provider-three",
          label: "Third review provider",
          content: <p>Third provider connection</p>,
        },
      ]}
    />,
  );
  expect(screen.getByText("Second provider connection")).toBeVisible();
  fireEvent.click(
    screen.getByRole("button", { name: "Third review provider" }),
  );
  expect(screen.getByText("Third provider connection")).toBeVisible();
  expect(
    screen.queryByText("Second provider connection"),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Senja" }));
  expect(screen.getByLabelText("Public wall URL")).toBeVisible();
  expect(
    screen.queryByText("Third provider connection"),
  ).not.toBeInTheDocument();
});
