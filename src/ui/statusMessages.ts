export const STATUS_MESSAGE_DURATION_MS = 5000;

export function getStatusMessageDismissDelay(
  createdAt: number,
  now = Date.now(),
): number {
  return Math.max(0, STATUS_MESSAGE_DURATION_MS - (now - createdAt));
}
