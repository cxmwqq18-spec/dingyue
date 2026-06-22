import { LogOut, UserRound } from "lucide-react";
import type { PublicCustomer } from "@/lib/types";

export function CustomerSessionBadge({
  customer,
  siteId,
  siteSlug
}: {
  customer: PublicCustomer;
  siteId: string;
  siteSlug: string;
}) {
  return (
    <div className="fixed right-4 top-24 z-[200] flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-full border border-black/10 bg-white/95 px-3 py-2 text-[#15171a] shadow-[0_18px_60px_-38px_rgba(0,0,0,0.45)] backdrop-blur">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#15171a] text-white">
        <UserRound className="h-4 w-4" strokeWidth={1.8} />
      </span>
      <span className="hidden min-w-0 sm:block">
        <span className="block max-w-[13rem] truncate text-sm font-semibold">{customer.name}</span>
        <span className="block max-w-[13rem] truncate text-xs text-[#64605a]">
          {customer.email} · {customer.balance.available} credits
        </span>
      </span>
      <form action={`/site/${siteSlug}/logout`} method="post">
        <input name="siteId" type="hidden" value={siteId} />
        <button className="inline-flex items-center gap-2 rounded-full border border-black/10 px-3 py-2 text-sm font-medium active:scale-[0.98]" type="submit">
          <LogOut className="h-4 w-4" strokeWidth={1.8} />
          Sign out
        </button>
      </form>
    </div>
  );
}
