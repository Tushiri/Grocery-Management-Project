import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "../page";

describe("HomePage", () => {
  it("renders the landing heading and description", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { name: /g-rocery/i })).toBeInTheDocument();
    expect(screen.getByText(/smart inventory/i)).toBeInTheDocument();
  });
});
