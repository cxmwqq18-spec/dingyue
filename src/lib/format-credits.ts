// Credits are shown as a count next to a noun all over the workspace, the
// partner program and the approval email. Writing the noun inline produced
// "1 credits" whenever a quote, a grant or a balance happened to be one.
//
// Quotes carry `number | null` (null means "this surface has no opinion yet"),
// and the call sites already guard that case, so a nullish count renders as the
// zero form rather than throwing.
export function creditLabel(count: number | null | undefined): string {
  const value = typeof count === "number" && Number.isFinite(count) ? count : 0;
  return `${value} ${value === 1 ? "credit" : "credits"}`;
}
