import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockPush = vi.fn();
const mockUpload = vi.fn();
const mockFrom = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/supabase/client", () => ({
  supabaseBrowser: () => ({
    storage: {
      from: mockFrom,
    },
  }),
}));

vi.stubGlobal("fetch", vi.fn());

const HOUSEHOLD_ID = "household-11111111-1111-1111-1111-111111111111";
const RECEIPT_ID = "receipt-22222222-2222-2222-2222-222222222222";

function createImageFile(name = "receipt.jpg", type = "image/jpeg", size = 1024) {
  const file = new File(["x".repeat(size)], name, { type });
  return file;
}

describe("ReceiptUploadForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({
      upload: mockUpload,
    });
    mockUpload.mockResolvedValue({ error: null });
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          pending_receipt_id: RECEIPT_ID,
          status: "PENDING",
          parsed: { store_name: "Test", date_purchased: "2026-08-27", line_items: [] },
          matched_via_lookup_count: 0,
          matched_via_gemini_count: 0,
        }),
        { status: 200 }
      )
    );
  });

  afterEach(() => {
    cleanup();
    vi.resetModules();
  });

  it("renders file input and store name field with submit disabled until file selected", async () => {
    const { ReceiptUploadForm } = await import("../ReceiptUploadForm");
    render(<ReceiptUploadForm householdId={HOUSEHOLD_ID} />);

    expect(screen.getByLabelText(/store name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/receipt photo/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /upload receipt/i })).toBeDisabled();
  });

  it("uploads to storage and calls the receipts API on valid submit", async () => {
    const { ReceiptUploadForm } = await import("../ReceiptUploadForm");
    const user = userEvent.setup();
    render(<ReceiptUploadForm householdId={HOUSEHOLD_ID} />);

    const fileInput = screen.getByLabelText(/receipt photo/i);
    await user.upload(fileInput, createImageFile());
    await user.type(screen.getByLabelText(/store name/i), "Costco");
    await user.click(screen.getByRole("button", { name: /upload receipt/i }));

    await waitFor(() => {
      expect(mockUpload).toHaveBeenCalled();
    });

    const uploadPath = mockUpload.mock.calls[0][0] as string;
    expect(uploadPath.startsWith(`${HOUSEHOLD_ID}/`)).toBe(true);
    expect(uploadPath.endsWith(".jpg")).toBe(true);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/receipts",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ storagePath: uploadPath, storeName: "Costco" }),
        })
      );
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(`/receipts/${RECEIPT_ID}`);
    });
  });

  it("shows an error when storage upload fails", async () => {
    mockUpload.mockResolvedValue({ error: { message: "Upload failed" } });
    const { ReceiptUploadForm } = await import("../ReceiptUploadForm");
    const user = userEvent.setup();
    render(<ReceiptUploadForm householdId={HOUSEHOLD_ID} />);

    await user.upload(screen.getByLabelText(/receipt photo/i), createImageFile());
    await user.click(screen.getByRole("button", { name: /upload receipt/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Upload failed");
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("shows an error when the receipts API fails", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "Processing failed" }), { status: 500 })
    );
    const { ReceiptUploadForm } = await import("../ReceiptUploadForm");
    const user = userEvent.setup();
    render(<ReceiptUploadForm householdId={HOUSEHOLD_ID} />);

    await user.upload(screen.getByLabelText(/receipt photo/i), createImageFile());
    await user.click(screen.getByRole("button", { name: /upload receipt/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Processing failed");
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("rejects invalid file types before upload", async () => {
    const { ReceiptUploadForm } = await import("../ReceiptUploadForm");
    const user = userEvent.setup();
    render(<ReceiptUploadForm householdId={HOUSEHOLD_ID} />);

    fireEvent.change(screen.getByLabelText(/receipt photo/i), {
      target: {
        files: [new File(["data"], "doc.pdf", { type: "application/pdf" })],
      },
    });
    await user.click(screen.getByRole("button", { name: /upload receipt/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/invalid file type/i);
    });
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("clears selected file when the file input is emptied", async () => {
    const { ReceiptUploadForm } = await import("../ReceiptUploadForm");
    const user = userEvent.setup();
    render(<ReceiptUploadForm householdId={HOUSEHOLD_ID} />);

    await user.upload(screen.getByLabelText(/receipt photo/i), createImageFile());
    expect(screen.getByRole("button", { name: /upload receipt/i })).toBeEnabled();

    fireEvent.change(screen.getByLabelText(/receipt photo/i), {
      target: { files: [] },
    });

    expect(screen.getByRole("button", { name: /upload receipt/i })).toBeDisabled();
  });

  it("uses default processing error when API response has no error field", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({}), { status: 500 }));
    const { ReceiptUploadForm } = await import("../ReceiptUploadForm");
    const user = userEvent.setup();
    render(<ReceiptUploadForm householdId={HOUSEHOLD_ID} />);

    await user.upload(screen.getByLabelText(/receipt photo/i), createImageFile());
    await user.click(screen.getByRole("button", { name: /upload receipt/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Processing failed");
    });
  });

  it("shows an error when submit is clicked without a file", async () => {
    const { ReceiptUploadForm } = await import("../ReceiptUploadForm");
    const user = userEvent.setup();
    render(<ReceiptUploadForm householdId={HOUSEHOLD_ID} />);

    const form = screen.getByRole("button", { name: /upload receipt/i }).closest("form");
    expect(form).toBeTruthy();
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/select a receipt photo/i);
    });
  });

  it("uploads png and webp files with the correct extension", async () => {
    const { ReceiptUploadForm } = await import("../ReceiptUploadForm");
    const user = userEvent.setup();
    render(<ReceiptUploadForm householdId={HOUSEHOLD_ID} />);

    fireEvent.change(screen.getByLabelText(/receipt photo/i), {
      target: {
        files: [new File(["data"], "receipt.png", { type: "image/png" })],
      },
    });
    await user.click(screen.getByRole("button", { name: /upload receipt/i }));

    await waitFor(() => {
      expect(mockUpload).toHaveBeenCalled();
    });
    expect((mockUpload.mock.calls[0][0] as string).endsWith(".png")).toBe(true);
  });

  it("uploads webp files with the webp extension", async () => {
    const { ReceiptUploadForm } = await import("../ReceiptUploadForm");
    const user = userEvent.setup();
    render(<ReceiptUploadForm householdId={HOUSEHOLD_ID} />);

    fireEvent.change(screen.getByLabelText(/receipt photo/i), {
      target: {
        files: [new File(["data"], "receipt.webp", { type: "image/webp" })],
      },
    });
    await user.click(screen.getByRole("button", { name: /upload receipt/i }));

    await waitFor(() => {
      expect(mockUpload).toHaveBeenCalled();
    });
    expect((mockUpload.mock.calls[0][0] as string).endsWith(".webp")).toBe(true);
  });

  it("rejects files over the size limit before upload", async () => {
    const { ReceiptUploadForm } = await import("../ReceiptUploadForm");
    const user = userEvent.setup();
    render(<ReceiptUploadForm householdId={HOUSEHOLD_ID} />);

    const oversized = createImageFile("big.jpg", "image/jpeg", 11 * 1024 * 1024);
    await user.upload(screen.getByLabelText(/receipt photo/i), oversized);
    await user.click(screen.getByRole("button", { name: /upload receipt/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/file too large/i);
    });
    expect(mockUpload).not.toHaveBeenCalled();
  });
});
