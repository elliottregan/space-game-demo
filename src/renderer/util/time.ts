// Small time/date formatting helpers.

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleString();
}

export function formatRelative(ts: number, now: number = Date.now()): string {
  const diffMs = now - ts;
  const m = Math.floor(diffMs / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
