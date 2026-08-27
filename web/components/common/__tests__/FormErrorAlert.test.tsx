import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FormErrorAlert } from "../FormErrorAlert";

describe("FormErrorAlert", () => {
  it("renders the error message with alert role", () => {
    render(<FormErrorAlert message="Something went wrong" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
  });
});
