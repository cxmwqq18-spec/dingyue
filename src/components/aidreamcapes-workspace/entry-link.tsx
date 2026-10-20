import type { ComponentProps } from "react";
import { workspaceEntryTarget, type WorkspaceEntryTransfer } from "@/lib/aidreamcapes-workspace/entry-transfer";

/** Server-rendered canonical links; the inert selection travels outside the URL. */
export function WorkspaceEntryLink({ href, mediaLink, entry, ...props }: ComponentProps<"a"> & { mediaLink?: boolean; entry?: WorkspaceEntryTransfer }) {
  const target = typeof href === "string" ? workspaceEntryTarget(href, mediaLink) : { href, transfer: undefined };
  return <a {...props} href={target.href} data-workspace-entry={entry || target.transfer ? JSON.stringify(entry ?? target.transfer) : undefined} />;
}
