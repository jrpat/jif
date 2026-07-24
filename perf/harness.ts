export type BenchmarkSummary = Readonly<{
  name: string;
  iterations: number;
  minMs: number;
  medianMs: number;
  p95Ms: number;
  maxMs: number;
}>;

export async function runBenchmark(
  name: string,
  task: () => void | Promise<void>,
  options: Readonly<{
    iterations: number;
    warmupIterations: number;
    beforeEach?: () => void | Promise<void>;
  }>,
): Promise<BenchmarkSummary> {
  for (let index = 0; index < options.warmupIterations; index += 1) {
    await options.beforeEach?.();
    await task();
  }

  const samples: number[] = [];
  for (let index = 0; index < options.iterations; index += 1) {
    await options.beforeEach?.();
    const startedAt = performance.now();
    await task();
    samples.push(performance.now() - startedAt);
  }

  return summarizeBenchmarkSamples(name, samples);
}

export function summarizeBenchmarkSamples(
  name: string,
  samples: readonly number[],
): BenchmarkSummary {
  if (samples.length === 0) {
    throw new Error(`Benchmark "${name}" needs at least one sample.`);
  }

  const sorted = [...samples].sort((left, right) => left - right);
  return {
    name,
    iterations: sorted.length,
    minMs: sorted[0]!,
    medianMs: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    maxMs: sorted.at(-1)!,
  };
}

export function formatBenchmarkSummary(summary: BenchmarkSummary): string {
  return [
    summary.name.padEnd(24),
    `median ${summary.medianMs.toFixed(2).padStart(7)} ms`,
    `p95 ${summary.p95Ms.toFixed(2).padStart(7)} ms`,
    `min ${summary.minMs.toFixed(2).padStart(7)} ms`,
    `max ${summary.maxMs.toFixed(2).padStart(7)} ms`,
    `n=${summary.iterations}`,
  ].join("  ");
}

export function assertBenchmarkBudget(
  summary: BenchmarkSummary,
  budget: Readonly<{ medianMs: number; p95Ms: number }>,
): void {
  const failures = [
    ...(summary.medianMs > budget.medianMs
      ? [`median ${summary.medianMs.toFixed(2)} ms > ${budget.medianMs.toFixed(2)} ms`]
      : []),
    ...(summary.p95Ms > budget.p95Ms
      ? [`p95 ${summary.p95Ms.toFixed(2)} ms > ${budget.p95Ms.toFixed(2)} ms`]
      : []),
  ];
  if (failures.length > 0) {
    throw new Error(`${summary.name} exceeded its performance budget: ${failures.join(", ")}`);
  }
}

function percentile(sortedSamples: readonly number[], fraction: number): number {
  const index = Math.min(
    sortedSamples.length - 1,
    Math.max(0, Math.ceil(sortedSamples.length * fraction) - 1),
  );
  return sortedSamples[index]!;
}
