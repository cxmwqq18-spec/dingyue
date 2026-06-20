import type { CreditLedgerEntry, LedgerType } from "./types";

export function calculateBalance(entries: CreditLedgerEntry[]): { available: number; reserved: number } {
  return entries.reduce(
    (acc, entry) => {
      if (entry.type === "reserve") {
        acc.reserved += Math.abs(entry.amount);
        return acc;
      }
      if (entry.type === "release") {
        acc.reserved = Math.max(0, acc.reserved - Math.abs(entry.amount));
        return acc;
      }
      acc.available += entry.amount;
      return acc;
    },
    { available: 0, reserved: 0 }
  );
}

export function nextLedgerEntry(params: {
  siteId: string;
  customerId: string;
  amount: number;
  type: LedgerType;
  sourceType: string;
  sourceId: string;
}): CreditLedgerEntry {
  return {
    id: `led_${params.sourceId}_${params.type}`,
    siteId: params.siteId,
    customerId: params.customerId,
    amount: params.amount,
    type: params.type,
    sourceType: params.sourceType,
    sourceId: params.sourceId,
    createdAt: new Date().toISOString()
  };
}
