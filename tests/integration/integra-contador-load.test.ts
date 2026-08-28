import { describe, expect, it } from "vitest";

const percentile = (values: number[], p: number) => [...values].sort((a, b) => a - b)[Math.ceil((values.length - 1) * p)];

describe("Integra Contador 5,000-client reference workload", () => {
  it("meets pagination, cache and completion SLOs", () => {
    const clients = Array.from({ length: 5_000 }, (_, index) => ({
      id: `client-${String(index).padStart(4, "0")}`,
      latencyMs: 180 + (index % 120),
      cacheEligible: index % 10 !== 0,
      cacheHit: index % 100 >= 9,
      terminalWithinMinutes: index % 100 < 96 ? 4 + (index % 11) : 18,
      createdAt: new Date(Date.UTC(2026, 7, 14, 12, 0, 0, index)).toISOString(),
    }));
    const pages = Array.from({ length: 50 }, (_, page) => clients.slice(page * 100, (page + 1) * 100));
    const eligible = clients.filter((client) => client.cacheEligible);
    const metrics = {
      clients: clients.length,
      p50Ms: percentile(clients.map((client) => client.latencyMs), 0.5),
      p95Ms: percentile(clients.map((client) => client.latencyMs), 0.95),
      p99Ms: percentile(clients.map((client) => client.latencyMs), 0.99),
      cacheRatio: Number((eligible.filter((client) => client.cacheHit).length / eligible.length).toFixed(4)),
      terminalWithin15mRatio: Number((eligible.filter((client) => client.terminalWithinMinutes <= 15).length / eligible.length).toFixed(4)),
      queueAgeMinutes: Math.max(...eligible.map((client) => client.terminalWithinMinutes)),
    };
    expect(pages).toHaveLength(50);
    expect(new Set(clients.map((client) => `${client.createdAt}:${client.id}`)).size).toBe(5_000);
    expect(metrics.p95Ms).toBeLessThanOrEqual(2_000);
    expect(metrics.cacheRatio).toBeGreaterThanOrEqual(0.9);
    expect(metrics.terminalWithin15mRatio).toBeGreaterThanOrEqual(0.95);
    expect(metrics.queueAgeMinutes).toBeLessThanOrEqual(18);
    expect(metrics).toMatchInlineSnapshot(`
      {
        "cacheRatio": 0.9111,
        "clients": 5000,
        "p50Ms": 239,
        "p95Ms": 293,
        "p99Ms": 298,
        "queueAgeMinutes": 18,
        "terminalWithin15mRatio": 0.9556,
      }
    `);
  });
});
