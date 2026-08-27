"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { addToBuyListEntry } from "@/app/actions/to-buy";
import { useToBuyList } from "@/lib/hooks/useToBuyList";
import { filterToBuyByStatus } from "@/lib/to-buy/apply-realtime-event";
import type { InventoryItem, ToBuyListEntryWithItem, ToBuyStatus } from "@/lib/types/database.types";

type ToBuyListProps = {
  householdId: string;
  initialEntries: ToBuyListEntryWithItem[];
  inventoryItems: InventoryItem[];
};

const STATUS_FILTERS: Array<ToBuyStatus | "ALL"> = ["ALL", "OPEN", "PARTIAL", "FULFILLED"];

export function ToBuyList({ householdId, initialEntries, inventoryItems }: ToBuyListProps) {
  const router = useRouter();
  const entries = useToBuyList(householdId, initialEntries);
  const [statusFilter, setStatusFilter] = useState<ToBuyStatus | "ALL">("OPEN");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredEntries = useMemo(
    () => filterToBuyByStatus(entries, statusFilter),
    [entries, statusFilter]
  );

  function handleAddEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const result = await addToBuyListEntry(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      form.reset();
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {error && (
        <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={`rounded px-3 py-1 text-sm ${
              statusFilter === status ? "bg-gray-900 text-white" : "border border-gray-300"
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      <form onSubmit={handleAddEntry} className="grid gap-3 rounded border border-gray-200 p-4 md:grid-cols-2">
        <h2 className="md:col-span-2 text-lg font-medium">Add to buy list</h2>

        <label className="space-y-1 text-sm md:col-span-2">
          <span>Inventory item</span>
          <select name="item_id" required className="w-full rounded border border-gray-300 px-3 py-2">
            <option value="">Select an item</option>
            {inventoryItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.standardized_name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span>Quantity</span>
          <input
            name="quantity_requested"
            type="number"
            min="0.01"
            step="0.01"
            defaultValue="1"
            required
            className="w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>

        <button
          type="submit"
          disabled={isPending || inventoryItems.length === 0}
          className="rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isPending ? "Adding…" : "Add to list"}
        </button>
      </form>

      {filteredEntries.length === 0 ? (
        <p className="text-gray-500">No to-buy entries for this filter.</p>
      ) : (
        <ul className="space-y-3">
          {filteredEntries.map((entry) => (
            <li key={entry.id} className="rounded border border-gray-200 p-3 text-sm">
              <p className="font-medium">
                {entry.inventory_items?.standardized_name ?? "Unknown item"}
              </p>
              <p className="text-gray-600">
                Remaining: {entry.quantity_remaining} / {entry.quantity_requested}{" "}
                {entry.inventory_items?.unit_type ?? ""}
              </p>
              <p className="text-gray-600">Status: {entry.status}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
