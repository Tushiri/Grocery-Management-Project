/** Receipt types mirroring ai-service/app/schemas/receipt.py */

export type ReceiptLineItem = {
  raw_text: string;
  standardized_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  category: string | null;
  matched_item_id: string | null;
  matched_via: "lookup" | "gemini";
};

export type ParsedReceipt = {
  store_name: string;
  date_purchased: string;
  line_items: ReceiptLineItem[];
};

export type ProcessReceiptRequest = {
  pending_receipt_id: string;
  household_id: string;
  storage_path: string;
};

export type ProcessReceiptResponse = {
  pending_receipt_id: string;
  status: "PENDING";
  parsed: ParsedReceipt;
  matched_via_lookup_count: number;
  matched_via_gemini_count: number;
};

export type ApproveReceiptRequest = {
  line_items: ReceiptLineItem[];
};

export type ApproveReceiptResponse = {
  pending_receipt_id: string;
  status: "APPROVED";
};
