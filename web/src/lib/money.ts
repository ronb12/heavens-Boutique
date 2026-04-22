export function formatUsd(cents: number | null | undefined): string {
  const v = Number(cents ?? 0);
  return `$${(v / 100).toFixed(2)}`;
}

