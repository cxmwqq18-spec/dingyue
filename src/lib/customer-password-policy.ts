export const customerPasswordPolicyMessage = "Password must be at least 8 characters and include uppercase, lowercase, number, and special character.";

export function getCustomerPasswordPolicyError(password: string | undefined, confirmPassword?: string): string | null {
  const normalized = String(password ?? "").trim();
  if (!normalized) return "password_required";
  if (normalized.length < 8) return "password_complexity_required";
  if (!/[a-z]/.test(normalized)) return "password_complexity_required";
  if (!/[A-Z]/.test(normalized)) return "password_complexity_required";
  if (!/\d/.test(normalized)) return "password_complexity_required";
  if (!/[^A-Za-z0-9]/.test(normalized)) return "password_complexity_required";
  if (typeof confirmPassword !== "string" || !confirmPassword.trim()) return "password_confirmation_required";
  if (normalized !== confirmPassword.trim()) return "password_confirmation_mismatch";
  return null;
}

export function normalizeCustomerPassword(password: string | undefined): string {
  return String(password ?? "").trim();
}
