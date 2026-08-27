/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import RootLayout, { metadata } from "../layout";

describe("RootLayout", () => {
  it("exports page metadata", () => {
    expect(metadata.title).toBe("G-rocery");
    expect(metadata.description).toBe("Smart Inventory & Procurement System");
  });

  it("renders children inside the document body", () => {
    render(
      <RootLayout>
        <div>Child content</div>
      </RootLayout>
    );

    expect(screen.getByText("Child content")).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("lang", "en");
  });
});
