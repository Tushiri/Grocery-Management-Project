"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { createInventoryItem, depleteInventoryItem } from "@/app/actions/inventory";
import { FormErrorAlert } from "@/components/common/FormErrorAlert";
import { useRealtimeInventory } from "@/lib/hooks/useRealtimeInventory";
import type { InventoryItem, PriorityLevel } from "@/lib/types/database.types";

type InventoryTableProps = {
  householdId: string;
  initialItems: InventoryItem[];
};

export function InventoryTable({ householdId, initialItems }: InventoryTableProps) {
  const router = useRouter();
  const items = useRealtimeInventory(householdId, initialItems);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAddItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const result = await createInventoryItem(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      form.reset();
      router.refresh();
    });
  }

  function handleDeplete(itemId: string) {
    setError(null);
    startTransition(async () => {
      const result = await depleteInventoryItem(itemId);
      if (result.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      {error && <FormErrorAlert message={error} />}

      <form onSubmit={handleAddItem} className="grid gap-3 rounded border border-gray-200 p-4 md:grid-cols-2">
        <h2 className="md:col-span-2 text-lg font-medium">Add inventory item</h2>

        <label className="space-y-1 text-sm">
          <span>Name</span>
          <input
            name="standardized_name"
            required
            className="w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span>Unit</span>
          <input name="unit_type" required className="w-full rounded border border-gray-300 px-3 py-2" />
        </label>

        <label className="space-y-1 text-sm">
          <span>Quantity</span>
          <input
            name="quantity"
            type="number"
            min="0"
            step="0.01"
            defaultValue="0"
            required
            className="w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span>Min threshold</span>
          <input
            name="min_threshold"
            type="number"
            min="0"
            step="0.01"
            defaultValue="0"
            required
            className="w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span>Priority</span>
          <select
            name="priority_tag"
            defaultValue="MEDIUM"
            className="w-full rounded border border-gray-300 px-3 py-2"
          >
            {(["LOW", "MEDIUM", "HIGH"] as PriorityLevel[]).map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span>Category (optional)</span>
          <input name="category" className="w-full rounded border border-gray-300 px-3 py-2" />
        </label>

        <button
          type="submit"
          disabled={isPending}
          className="md:col-span-2 rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isPending ? "Adding…" : "Add item"}
        </button>
      </form>

      {items.length === 0 ? (
        <p className="text-gray-500">No items yet. Add your first pantry item above.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Quantity</th>
              <th className="py-2 pr-4">Priority</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-gray-100">
                <td className="py-2 pr-4">{item.standardized_name}</td>
                <td className="py-2 pr-4">
                  {item.quantity} {item.unit_type}
                </td>
                <td className="py-2 pr-4">{item.priority_tag}</td>
                <td className="py-2">
                  <button
                    type="button"
                    onClick={() => handleDeplete(item.id)}
                    disabled={isPending || item.quantity <= 0}
                    className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-50"
                  >
                    Deplete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
