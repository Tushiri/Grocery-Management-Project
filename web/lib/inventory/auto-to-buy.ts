import type { PriorityLevel } from "@/lib/types/database.types";

type AutoToBuyInput = {
  priority_tag: PriorityLevel;
  quantity: number;
  min_threshold: number;
};

/** Whether depleting stock should auto-create a to-buy entry (HIGH/MEDIUM only). */
export function shouldCreateAutoToBuyEntry(item: AutoToBuyInput): boolean {
  if (item.priority_tag === "LOW") {
    return false;
  }
  return item.quantity === 0 || item.quantity < item.min_threshold;
}

/** Quantity to request when auto-adding to the buy list. */
export function autoToBuyQuantity(item: Pick<AutoToBuyInput, "quantity" | "min_threshold">): number {
  return Math.max(1, item.min_threshold - item.quantity);
}
