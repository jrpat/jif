import { testRender } from "@opentui/solid";
import { resolveAppConfig } from "../../src/config/index.ts";
import { InlineConfirmation } from "../../src/ui/InlineConfirmation.tsx";
import { CommandPreview } from "../../src/ui/prompts.tsx";
import { RevisionItem } from "../../src/ui/render.tsx";
import { createAppStore } from "../../src/state/appStore.ts";
import type { RevisionSummary } from "../../src/domain/types.ts";

const config = resolveAppConfig({ commands: { layout: "loose" } });

type CapturedSpans = Awaited<ReturnType<typeof testRender>>["captureSpans"] extends () => infer T ? T : never;
type CapturedSpan = CapturedSpans["lines"][number]["spans"][number];

function findSpan(frame: CapturedSpans, text: string): CapturedSpan {
  const span = frame.lines
    .flatMap((line) => line.spans)
    .find((candidate) => candidate.text.includes(text));

  if (!span) {
    throw new Error(`Expected to find span containing ${text}.`);
  }

  return span;
}

function createRevision(overrides: Partial<RevisionSummary> = {}): RevisionSummary {
  return {
    rowId: "curr",
    revisionId: "curr",
    changeIdPrefixLength: 2,
    commitId: "currcommit",
    description: "working copy",
    localTimestamp: "2026-04-29 12:00:00",
    bookmarks: [],
    workspaces: [],
    graphRows: ["@  ", "│  "],
    isEmpty: false,
    hasConflict: false,
    marker: "working-copy",
    filesLoaded: true,
    files: [{ path: "src/app.ts", status: "M" }],
    ...overrides,
  };
}

async function renderInlineConfirmation(width: number) {
  const rendered = await testRender(() => (
    <box width={width} flexDirection="column">
      <InlineConfirmation
        config={config}
        message="Split only selected files?"
        options={["yes", "interactive", "no"]}
        selectedOption="interactive"
      />
    </box>
  ), { width, height: 8 });

  try {
    await rendered.renderOnce();
    const frame = rendered.captureCharFrame();
    const spans = rendered.captureSpans();
    const selectedSpan = findSpan(spans, "Interactive");
    const normalSpan = findSpan(spans, "Yes");
    return {
      frame,
      selectedSpan: {
        fg: selectedSpan.fg.toInts(),
        bg: selectedSpan.bg.toInts(),
        attributes: (selectedSpan as any).attributes ?? 0,
      },
      normalSpan: {
        fg: normalSpan.fg.toInts(),
        bg: normalSpan.bg.toInts(),
        attributes: (normalSpan as any).attributes ?? 0,
      },
    };
  } finally {
    rendered.renderer.destroy();
  }
}

async function renderCommandPreview() {
  const rendered = await testRender(() => (
    <box width={48} flexDirection="column">
      <CommandPreview
        config={config}
        commandSegments={[
          { text: "split -r a ", style: "command" },
          { text: "…files…", style: "files" },
        ]}
      />
    </box>
  ), { width: 48, height: 4 });

  try {
    await rendered.renderOnce();
    const frame = rendered.captureCharFrame();
    const spans = rendered.captureSpans();
    const filesSpan = findSpan(spans, "…files…");
    const commandSpan = findSpan(spans, "split -r a");
    return {
      frame,
      filesSpan: {
        fg: filesSpan.fg.toInts(),
        bg: filesSpan.bg.toInts(),
        attributes: (filesSpan as any).attributes ?? 0,
      },
      commandSpan: {
        fg: commandSpan.fg.toInts(),
        bg: commandSpan.bg.toInts(),
        attributes: (commandSpan as any).attributes ?? 0,
      },
    };
  } finally {
    rendered.renderer.destroy();
  }
}

async function renderRevisionItemWithConfirmation() {
  const store = createAppStore("/tmp/repo", { layout: "loose" });
  store.actions.applyRepositoryData({
    repoPath: "/tmp/repo",
    revisions: [createRevision()],
  });
  store.actions.openFocusedRevision();
  store.actions.toggleFileSelection();
  store.actions.openInlineConfirmation({
    kind: "split-files",
    rowId: "curr",
    message: "Split only selected files?",
    options: ["yes", "interactive", "no"],
    selectedOption: "yes",
    actualCommandByOption: {
      yes: "split -r cu /tmp/repo/src/app.ts",
      interactive: "split -i -r cu /tmp/repo/src/app.ts",
      no: "split -r cu",
    },
    previewCommandByOption: {
      yes: "split -r cu …files…",
      interactive: "split -i -r cu …files…",
      no: "split -r cu",
    },
  });

  const rendered = await testRender(() => (
    <box width={52} flexDirection="column">
      <RevisionItem
        state={store.state}
        revision={store.state.revisions[0]!}
        index={0}
        previousRowId={null}
        nextRowId={null}
        config={config}
        focusedRowId={store.state.revisions[0]?.rowId ?? null}
        selectedRowIds={new Set()}
        expandedRowId={store.state.revisions[0]?.rowId ?? null}
        commandTargetRowId={null}
      />
    </box>
  ), { width: 52, height: 10 });

  try {
    await rendered.renderOnce();
    // RevisionItem loads InlineConfirmation through a deferred import; give
    // the module a tick to resolve, then render the swapped-in component.
    await new Promise((resolve) => setTimeout(resolve, 10));
    await rendered.renderOnce();
    return {
      frame: rendered.captureCharFrame(),
    };
  } finally {
    rendered.renderer.destroy();
    store.dispose();
  }
}

const wide = await renderInlineConfirmation(52);
const narrow = await renderInlineConfirmation(34);
const preview = await renderCommandPreview();
const revision = await renderRevisionItemWithConfirmation();

console.log(JSON.stringify({
  wide,
  narrow,
  preview,
  revision,
}));
