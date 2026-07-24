import { resolve } from "node:path";
import { createSignal } from "solid-js";
import { testRender } from "@opentui/solid";
import { resolveAppConfig } from "../src/config/index.ts";
import { JjClient } from "../src/jj/client.ts";
import { createAppStore } from "../src/state/appStore.ts";
import { RevisionLogSurface } from "../src/ui/render.tsx";
import {
  assertBenchmarkBudget,
  formatBenchmarkSummary,
  runBenchmark,
  type BenchmarkSummary,
} from "./harness.ts";

type Options = Readonly<{
  repoPath: string;
  scenario: "all" | "layout" | "oplog";
  iterations: number;
  warmupIterations: number;
  width: number;
  height: number;
  medianBudgetMs: number | null;
  p95BudgetMs: number | null;
  json: boolean;
}>;

const options = parseOptions(process.argv.slice(2));
const client = new JjClient(options.repoPath);
const data = await client.loadRepository(250, undefined, { workingCopy: "read-only" });
const store = createAppStore(options.repoPath, { layout: "loose" });
store.actions.applyRepositoryData(data);
const config = resolveAppConfig({
  commands: { layout: "loose" },
  preview: { showByDefault: false },
});
const [showRevisionLog, setShowRevisionLog] = createSignal(true);

const rendered = await testRender(() => (
  <box width="100%" height="100%" flexDirection="column">
    <scrollbox width="100%" height="100%" scrollY>
      <box width="100%" flexDirection="column">
        <RevisionLogSurface
          visible={showRevisionLog()}
          state={store.state}
          config={config}
        />
        <box visible={!showRevisionLog()} width="100%" padding={1}>
          <text>operation log placeholder</text>
        </box>
      </box>
    </scrollbox>
  </box>
), {
  width: options.width,
  height: options.height,
});

try {
  await rendered.renderOnce();
  const summaries: BenchmarkSummary[] = [];

  if (options.scenario !== "oplog") {
    for (const [from, to] of [
      ["loose", "normal"],
      ["normal", "tight"],
      ["tight", "loose"],
    ] as const) {
      summaries.push(await runBenchmark(`${from} -> ${to}`, async () => {
        store.actions.cycleLayout();
        await rendered.renderOnce();
      }, {
        ...options,
        beforeEach: () => setLayout(from),
      }));
    }
  }

  if (options.scenario !== "layout") {
    summaries.push(await runBenchmark("oplog -> revisions", async () => {
      setShowRevisionLog(true);
      await rendered.renderOnce();
    }, {
      ...options,
      beforeEach: async () => {
        setShowRevisionLog(false);
        await rendered.renderOnce();
      },
    }));
  }

  if (options.json) {
    console.log(JSON.stringify({
      repoPath: options.repoPath,
      revisionCount: data.revisions.length,
      viewport: { width: options.width, height: options.height },
      benchmarks: summaries,
    }, null, 2));
  } else {
    console.log(
      `Revision rendering: ${data.revisions.length} revisions, ${options.width}x${options.height}, ${options.repoPath}`,
    );
    for (const summary of summaries) {
      console.log(formatBenchmarkSummary(summary));
    }
  }

  if (options.medianBudgetMs !== null && options.p95BudgetMs !== null) {
    for (const summary of summaries) {
      assertBenchmarkBudget(summary, {
        medianMs: options.medianBudgetMs,
        p95Ms: options.p95BudgetMs,
      });
    }
  }
} finally {
  rendered.renderer.destroy();
  store.dispose();
}

async function setLayout(layout: "loose" | "normal" | "tight"): Promise<void> {
  while (store.state.layout !== layout) {
    store.actions.cycleLayout();
  }
  await rendered.renderOnce();
}

function parseOptions(argv: readonly string[]): Options {
  const values = new Map<string, string>();
  let json = false;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]!;
    if (token === "--json") {
      json = true;
      continue;
    }
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for ${token}`);
    }
    values.set(token, value);
    index += 1;
  }

  const numberOption = (name: string, fallback: number): number => {
    const raw = values.get(name);
    if (raw === undefined) return fallback;
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`${name} must be a positive number.`);
    }
    return value;
  };

  const scenario = values.get("--scenario") ?? "all";
  if (scenario !== "all" && scenario !== "layout" && scenario !== "oplog") {
    throw new Error("--scenario must be one of: all, layout, oplog.");
  }
  if (values.has("--median-budget-ms") !== values.has("--p95-budget-ms")) {
    throw new Error("--median-budget-ms and --p95-budget-ms must be provided together.");
  }

  return {
    repoPath: resolve(values.get("--repo") ?? process.cwd()),
    scenario,
    iterations: numberOption("--iterations", 30),
    warmupIterations: numberOption("--warmup", 5),
    width: numberOption("--width", 160),
    height: numberOption("--height", 45),
    medianBudgetMs: values.has("--median-budget-ms")
      ? numberOption("--median-budget-ms", 0)
      : null,
    p95BudgetMs: values.has("--p95-budget-ms")
      ? numberOption("--p95-budget-ms", 0)
      : null,
    json,
  };
}
