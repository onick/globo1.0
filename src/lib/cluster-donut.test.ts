import { describe, expect, it } from "vitest";
import { clusterSize, donutArcs } from "@/lib/cluster-donut";

const ORDER = ["moving", "stopped", "idle", "offline"] as const;

describe("donutArcs", () => {
  it("splits the ring by status, in order, skipping empty ones", () => {
    expect(donutArcs({ moving: 1, stopped: 0, idle: 1, offline: 2 }, ORDER)).toEqual([
      { key: "moving", start: 0, length: 0.25 },
      { key: "idle", start: 0.25, length: 0.25 },
      { key: "offline", start: 0.5, length: 0.5 },
    ]);
  });

  it("is one full arc when all vehicles share a status", () => {
    expect(donutArcs({ offline: 251 }, ORDER)).toEqual([{ key: "offline", start: 0, length: 1 }]);
  });

  it("is empty without vehicles", () => {
    expect(donutArcs({}, ORDER)).toEqual([]);
  });
});

describe("clusterSize", () => {
  it("grows with the number of vehicles", () => {
    expect([clusterSize(3), clusterSize(73), clusterSize(251), clusterSize(1200)]).toEqual([34, 40, 46, 52]);
  });
});
