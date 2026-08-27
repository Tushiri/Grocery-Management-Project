import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetHouseholdId = vi.fn();

vi.mock("@/lib/household/get-household-id", () => ({
  getHouseholdIdForUser: () => mockGetHouseholdId(),
}));

vi.mock("@/components/receipts/ReceiptUploadForm", () => ({
  ReceiptUploadForm: ({ householdId }: { householdId: string }) => (
    <div>ReceiptUploadForm:{householdId}</div>
  ),
}));

describe("ReceiptsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockGetHouseholdId.mockResolvedValue("household-1");
  });

  it("renders the upload form for the user household", async () => {
    const ReceiptsPage = (await import("../page")).default;
    render(await ReceiptsPage());

    expect(screen.getByText("ReceiptUploadForm:household-1")).toBeInTheDocument();
  });
});
