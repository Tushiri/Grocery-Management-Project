"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ParsedReceipt, ReceiptLineItem } from "@/lib/receipts/types";

type ReceiptReviewFormProps = {
  pendingReceiptId: string;
  parsed: ParsedReceipt;
  status: string;
};

function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}

function recalculateTotal(line: ReceiptLineItem): ReceiptLineItem {
  return {
    ...line,
    total_price: Number((line.quantity * line.unit_price).toFixed(2)),
  };
}

export function ReceiptReviewForm({ pendingReceiptId, parsed, status }: ReceiptReviewFormProps) {
  const router = useRouter();
  const [lineItems, setLineItems] = useState<ReceiptLineItem[]>(parsed.line_items);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateLine(index: number, patch: Partial<ReceiptLineItem>) {
    setLineItems((current) =>
      current.map((line, lineIndex) => {
        if (lineIndex !== index) {
          return line;
        }
        return recalculateTotal({ ...line, ...patch });
      })
    );
  }

  async function handleApprove() {
    setError(null);
    setIsSubmitting(true);

    const response = await fetch(`/api/receipts/${pendingReceiptId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ line_items: lineItems }),
    });

    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setError(body.error ?? "Approval failed");
      setIsSubmitting(false);
      return;
    }

    router.push("/inventory");
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gray-500">Status: {status}</p>
        <p className="text-lg font-medium">{parsed.store_name}</p>
        <p className="text-sm text-gray-600">Purchased: {parsed.date_purchased}</p>
      </div>

      {error && (
        <div role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2 pr-4">Item</th>
            <th className="py-2 pr-4">Qty</th>
            <th className="py-2 pr-4">Unit price</th>
            <th className="py-2 pr-4">Total</th>
            <th className="py-2">Match</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((line, index) => (
            <tr key={`${line.raw_text}-${index}`} className="border-b">
              <td className="py-2 pr-4">{line.standardized_name}</td>
              <td className="py-2 pr-4">
                <label className="sr-only" htmlFor={`quantity-${index}`}>
                  Quantity
                </label>
                <input
                  id={`quantity-${index}`}
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={line.quantity}
                  onChange={(event) =>
                    updateLine(index, { quantity: Number(event.target.value) })
                  }
                  className="w-20 rounded border border-gray-300 px-2 py-1"
                />
              </td>
              <td className="py-2 pr-4">
                <label className="sr-only" htmlFor={`unit-price-${index}`}>
                  Unit price
                </label>
                <input
                  id={`unit-price-${index}`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.unit_price}
                  onChange={(event) =>
                    updateLine(index, { unit_price: Number(event.target.value) })
                  }
                  className="w-24 rounded border border-gray-300 px-2 py-1"
                />
              </td>
              <td className="py-2 pr-4">{formatCurrency(line.total_price)}</td>
              <td className="py-2">
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs">{line.matched_via}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button
        type="button"
        onClick={handleApprove}
        disabled={isSubmitting}
        className="rounded bg-green-600 px-4 py-2 text-white disabled:opacity-50"
      >
        {isSubmitting ? "Approving..." : "Approve receipt"}
      </button>
    </div>
  );
}
