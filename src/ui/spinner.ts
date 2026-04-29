export const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;
export const SPINNER_INTERVAL_MS = 80;

export function formatSpinnerText(text: string, frameIndex: number): string {
  const normalizedIndex = ((frameIndex % SPINNER_FRAMES.length) + SPINNER_FRAMES.length) % SPINNER_FRAMES.length;
  return `${SPINNER_FRAMES[normalizedIndex]!} ${text}`;
}