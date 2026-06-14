export function parseUtcTimestamp(timestamp: string): number {
  const parsed = Date.parse(timestamp);

  if (isNaN(parsed)) {
    console.error("Invalid UTC timestamp:", timestamp);
    return 0;
  }

  return parsed;
}

export function getTimeRemaining(expiresAt: string): number {
  const expiryMs = parseUtcTimestamp(expiresAt);
  return expiryMs - Date.now();
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "Expired";

  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}