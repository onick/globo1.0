// Ring around a cluster of vehicles on the map: one arc per status, sized by how many of
// the cluster's vehicles are in it (like Trakzee's clusters)

export interface DonutArc {
  key: string;
  // Fractions of the ring, 0–1
  start: number;
  length: number;
}

export function donutArcs(counts: Record<string, number>, order: readonly string[]): DonutArc[] {
  const total = order.reduce((sum, key) => sum + Math.max(0, counts[key] ?? 0), 0);
  if (total === 0) return [];
  const arcs: DonutArc[] = [];
  let start = 0;
  for (const key of order) {
    const count = Math.max(0, counts[key] ?? 0);
    if (!count) continue;
    arcs.push({ key, start, length: count / total });
    start += count / total;
  }
  return arcs;
}

// Bigger clusters get bigger circles
export function clusterSize(count: number): number {
  return count < 10 ? 34 : count < 100 ? 40 : count < 1000 ? 46 : 52;
}
