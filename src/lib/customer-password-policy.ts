export const customerPasswordPolicyMessage = "Password must be at least 6 characters.";

export function getCustomerPasswordPolicyError(password: string | undefined, confirmPassword?: string): string | null {
  const normalized = String(password ?? "").trim();
  if (!normalized) return "password_required";
  if (normalized.length < 6) return "password_min_6_chars";
  if (typeof confirmPassword !== "string" || !confirmPassword.trim()) return "password_confirmation_required";
  if (normalized !== confirmPassword.trim()) return "password_confirmation_mismatch";
  return null;
}

export function normalizeCustomerPassword(password: string | undefined): string {
  return String(password ?? "").trim();
}
