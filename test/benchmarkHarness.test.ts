import { expect, test } from "bun:test";
import {
  assertBenchmarkBudget,
  formatBenchmarkSummary,
  summarizeBenchmarkSamples,
} from "../perf/harness.ts";

test("benchmark summaries report stable nearest-rank percentiles", () => {
  const summary = summarizeBenchmarkSamples(
    "revision render",
    [10, 1, 6, 2, 8, 3, 9, 4, 7, 5, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
  );

  expect(summary).toEqual({
    name: "revision render",
    iterations: 20,
    minMs: 1,
    medianMs: 10,
    p95Ms: 19,
    maxMs: 20,
  });
  expect(formatBenchmarkSummary(summary)).toContain("median   10.00 ms");
});

test("benchmark budgets fail on either median or tail latency", () => {
  const summary = summarizeBenchmarkSamples("revision render", [10, 20, 30]);

  expect(() => assertBenchmarkBudget(summary, { medianMs: 25, p95Ms: 35 })).not.toThrow();
  expect(() => assertBenchmarkBudget(summary, { medianMs: 15, p95Ms: 35 }))
    .toThrow("median 20.00 ms > 15.00 ms");
  expect(() => assertBenchmarkBudget(summary, { medianMs: 25, p95Ms: 25 }))
    .toThrow("p95 30.00 ms > 25.00 ms");
});
