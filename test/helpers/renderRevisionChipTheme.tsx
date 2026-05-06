import { testRender } from "@opentui/solid";
import { createSignal, type Setter } from "solid-js";
import type { RGBA } from "@opentui/core";
import { resolveAppConfig, type ResolvedAppConfig } from "../../src/config/index.ts";
import type { RevisionSummary } from "../../src/domain/types.ts";
import { createAppStore } from "../../src/state/appStore.ts";
import { RevisionItem } from "../../src/ui/render.tsx";

function createRevision(overrides: Partial<RevisionSummary> = {}): RevisionSummary {
  return {
    rowId: "curr",
    revisionId: "curr",
    changeIdPrefixLength: 2,
    commitId: "currcommit",
    description: "branch",
    localTimestamp: "2026-04-15 12:00:00",
    bookmarks: ["main"],
    workspaces: [],
    graphRows: ["@  ", "│  "],
    isEmpty: false,
    hasConflict: false,
    marker: "plain",
    filesLoaded: false,
    files: [],
    ...overrides,
  };
}

function createConfig(colors?: ResolvedAppConfig["colorScheme"]["semanticColors"] extends infer _T ? {
  bookmarkTagFill?: string;
  bookmarkTagText?: string;
  workspaceTagFill?: string;
  workspaceTagText?: string;
} : never): ResolvedAppConfig {
  return resolveAppConfig({
    commands: { layout: "expanded" },
    colorScheme: {
      colors: {
        ...colors,
      },
    },
  });
}

type CapturedFrame = Awaited<ReturnType<typeof testRender>>["captureSpans"] extends () => infer T ? T : never;

function findChipBackground(frame: CapturedFrame, text: string): RGBA {
  const chipSpan = frame.lines
    .flatMap((line) => line.spans)
    .find((span) => span.text.includes(text));

  if (!chipSpan) {
    throw new Error(`Expected to find a chip span for ${text}.`);
  }

  return chipSpan.bg;
}

async function renderChipBackgrounds(args: {
  revision: RevisionSummary;
  config: ResolvedAppConfig;
}) {
  const store = createAppStore("/tmp/repo", { layout: "expanded" });
  store.actions.applyRepositoryData({
    repoPath: "/tmp/repo",
    revisions: [args.revision],
  });

  const rendered = await testRender(() => (
    <box width={48} flexDirection="column">
      <RevisionItem
        state={store.state}
        revision={store.state.revisions[0]!}
        index={0}
        previousRowId={null}
        nextRowId={null}
        config={args.config}
        focusedRowId={null}
        selectedRowIds={new Set()}
        expandedRowId={null}
        commandTargetRowId={null}
      />
    </box>
  ), { width: 48, height: 6 });

  try {
    await rendered.renderOnce();
    const frame = rendered.captureSpans();
    return {
      bookmarkBg: findChipBackground(frame, "main").toInts(),
      workspaceBg: findChipBackground(frame, "review").toInts(),
    };
  } finally {
    rendered.renderer.destroy();
    store.dispose();
  }
}

const store = createAppStore("/tmp/repo", { layout: "expanded" });
store.actions.applyRepositoryData({
  repoPath: "/tmp/repo",
  revisions: [createRevision()],
});

const initialConfig = createConfig({
  bookmarkTagFill: "#112233",
  bookmarkTagText: "#111111",
  workspaceTagFill: "#112233",
  workspaceTagText: "#111111",
});
const refreshedConfig = createConfig({
  bookmarkTagFill: "#ddeeff",
  bookmarkTagText: "#111111",
  workspaceTagFill: "#ddeeff",
  workspaceTagText: "#111111",
});
let setConfig!: Setter<ResolvedAppConfig>;

const rendered = await testRender(() => {
  const [config, updateConfig] = createSignal(initialConfig);
  setConfig = updateConfig;

  return (
    <box width={48} flexDirection="column">
      <RevisionItem
        state={store.state}
        revision={store.state.revisions[0]!}
        index={0}
        previousRowId={null}
        nextRowId={null}
        config={config()}
        focusedRowId={null}
        selectedRowIds={new Set()}
        expandedRowId={null}
        commandTargetRowId={null}
      />
    </box>
  );
}, { width: 48, height: 6 });

try {
  await rendered.renderOnce();
  const initialBg = findChipBackground(rendered.captureSpans(), "main").toInts();

  setConfig(refreshedConfig);
  await rendered.renderOnce();
  const refreshedBg = findChipBackground(rendered.captureSpans(), "main").toInts();

  const defaultColors = await renderChipBackgrounds({
    revision: createRevision({ workspaces: ["review"] }),
    config: createConfig(),
  });
  const overrideColors = await renderChipBackgrounds({
    revision: createRevision({ workspaces: ["review"] }),
    config: createConfig({
      bookmarkTagFill: "#112233",
      bookmarkTagText: "#111111",
      workspaceTagFill: "#ddeeff",
      workspaceTagText: "#222222",
    }),
  });

  console.log(JSON.stringify({
    initialBg,
    refreshedBg,
    defaultBookmarkBg: defaultColors.bookmarkBg,
    defaultWorkspaceBg: defaultColors.workspaceBg,
    overrideBookmarkBg: overrideColors.bookmarkBg,
    overrideWorkspaceBg: overrideColors.workspaceBg,
  }));
} finally {
  rendered.renderer.destroy();
  store.dispose();
}
