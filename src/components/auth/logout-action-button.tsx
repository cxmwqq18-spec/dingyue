"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";

export function LogoutActionButton({
  endpoint,
  redirectTo,
  label = "退出登录",
  tone = "light",
  className
}: {
  endpoint: string;
  redirectTo: string;
  label?: string;
  tone?: "light" | "dark";
  className?: string;
}) {
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    await fetch(endpoint, { method: "POST" });
    window.location.href = redirectTo;
  }

  return (
    <button
      className={`${className ?? ""} rounded-full px-4 py-2 text-sm active:scale-[0.98] ${
        tone === "dark"
          ? "rounded-[8px] border border-white/10 bg-white/[0.04] text-stone-200 hover:bg-white/[0.08]"
          : "border border-black/10 bg-white text-zinc-700 hover:bg-zinc-50"
      }`}
      disabled={pending}
      onClick={logout}
    >
      <LogOut className="mr-2 inline h-4 w-4" strokeWidth={1.8} />
      {pending ? "退出中" : label}
    </button>
  );
}
