/**
 * Shared normalization for guest contact fields used by:
 *  - /api/tickets/payment-order (card flow guest user insert)
 *  - /api/tickets/bank-transfer-order (bank transfer guest user insert)
 *  - /api/me/link-guest-bookings (merge criteria at signup)
 *  - signup_with_guest_merge RPC (matches LOWER(email) and regexp_replace(phone))
 *
 * Keep normalization in one place so entry points write data that
 * later matching logic always hits.
 */

/**
 * Email → trimmed + lowercase, or null if empty.
 */
export function normalizeGuestEmail(value: unknown): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim().toLowerCase();
  return trimmed || null;
}

/**
 * Phone → digits only, or null if empty.
 * Does not enforce length; callers that need phone≥9 digits should check separately.
 */
export function normalizeGuestPhone(value: unknown): string | null {
  if (value == null) return null;
  const digits = String(value).replace(/\D/g, '');
  return digits || null;
}
