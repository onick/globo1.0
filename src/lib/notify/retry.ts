// When to try a failed notification again

// Wait after the 1st, 2nd, 3rd and 4th failure; the 5th failure is final
export const RETRY_DELAYS_SEC = [30, 120, 600, 1800];
export const MAX_ATTEMPTS = RETRY_DELAYS_SEC.length + 1;

export function afterFailure(
  attempts: number,
  now: Date
): { status: "failed" } | { status: "pending"; nextAttemptAt: Date } {
  if (attempts >= MAX_ATTEMPTS) return { status: "failed" };
  return {
    status: "pending",
    nextAttemptAt: new Date(now.getTime() + RETRY_DELAYS_SEC[attempts - 1] * 1000),
  };
}
