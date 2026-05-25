import { For } from "solid-js";
import { RGBA, type ScrollBoxRenderable } from "@opentui/core";
import { testRender } from "@opentui/solid";
import { resolveAppConfig } from "../../src/config/index.ts";
import type { OperationLogEntry, RevisionSummary } from "../../src/domain/types.ts";
import { createAppStore } from "../../src/state/appStore.ts";
import { OperationLogEntryItem } from "../../src/ui/OperationLogEntryItem.tsx";
import { RevisionItem } from "../../src/ui/render.tsx";
import { SearchHighlightLayer } from "../../src/ui/searchOverlay.tsx";

const config = resolveAppConfig({ commands: { layout: "loose" } });

type CapturedSpans = Awaited<ReturnType<typeof testRender>>["captureSpans"] extends () => infer T ? T : never;

const expectedHighlightFg = config.colorScheme.semanticColors.chromeFillOne;
const expectedHighlightBg = config.colorScheme.semanticColors.textPrimary;

function highlightTexts(frame: CapturedSpans): string[] {
  return frame.lines
    .flatMap((line) => line.spans)
    .filter((span) => colorMatches(span.fg, expectedHighlightFg) && colorMatches(span.bg, expectedHighlightBg))
    .map((span) => span.text);
}

function colorMatches(color: RGBA, hex: string | undefined): boolean {
  return Boolean(hex && color.equals(RGBA.fromHex(hex)));
}

function createRevision(overrides: Partial<RevisionSummary> = {}): RevisionSummary {
  const revisionId = overrides.revisionId ?? "curr";
  return {
    rowId: overrides.rowId ?? revisionId,
    revisionId,
    changeIdPrefixLength: overrides.changeIdPrefixLength ?? 2,
    commitId: overrides.commitId ?? `${revisionId}commit`,
    description: overrides.description ?? "branch revision",
    localTimestamp: "2026-05-06 12:00:00",
    bookmarks: overrides.bookmarks ?? [],
    workspaces: overrides.workspaces ?? [],
    graphRows: overrides.graphRows ?? ["@  ", "│  "],
    isEmpty: false,
    hasConflict: false,
    marker: "plain",
    filesLoaded: true,
    files: [],
    ...overrides,
  };
}

async function renderRevisionSearch(query: string) {
  const store = createAppStore("/tmp/repo", { layout: "loose" });
  store.actions.applyRepositoryData({
    repoPath: "/tmp/repo",
    revisions: [
      createRevision({
        rowId: "curr",
        revisionId: "current",
        description: "branch revision",
        bookmarks: ["main"],
      }),
    ],
  });
  store.actions.openSearch();
  store.actions.setSearchText(query);

  let viewport: ScrollBoxRenderable | undefined;
  const rendered = await testRender(() => (
    <box width={64} height={8} position="relative">
      <scrollbox
        ref={(el: ScrollBoxRenderable) => {
          viewport = el;
        }}
        width="100%"
        height="100%"
        scrollY
      >
        <For each={store.state.revisions}>
          {(revision, index) => (
            <RevisionItem
              state={store.state}
              revision={revision}
              revisionChangeIdDisplayLength={4}
              index={index()}
              previousRowId={null}
              nextRowId={null}
              config={config}
              focusedRowId={store.state.revisions[store.state.focusedRevisionIndex]?.rowId ?? null}
              selectedRowIds={new Set()}
              expandedRowId={null}
              commandTargetRowId={null}
            />
          )}
        </For>
      </scrollbox>
      <SearchHighlightLayer
        state={store.state}
        config={config}
        getViewport={() => viewport}
      />
    </box>
  ), { width: 64, height: 8 });

  try {
    await rendered.renderOnce();
    return {
      frame: rendered.captureCharFrame(),
      highlightTexts: highlightTexts(rendered.captureSpans()),
    };
  } finally {
    rendered.renderer.destroy();
    store.dispose();
  }
}

async function renderInactiveRevisionWithEmoji() {
  const store = createAppStore("/tmp/repo", { layout: "loose" });
  store.actions.applyRepositoryData({
    repoPath: "/tmp/repo",
    revisions: [
      createRevision({
        rowId: "curr",
        revisionId: "current",
        description: "🔒 StopStream cross-hatch",
      }),
    ],
  });

  let viewport: ScrollBoxRenderable | undefined;
  const rendered = await testRender(() => (
    <box width={64} height={6} position="relative">
      <scrollbox
        ref={(el: ScrollBoxRenderable) => {
          viewport = el;
        }}
        width="100%"
        height="100%"
        scrollY
      >
        <For each={store.state.revisions}>
          {(revision, index) => (
            <RevisionItem
              state={store.state}
              revision={revision}
              revisionChangeIdDisplayLength={4}
              index={index()}
              previousRowId={null}
              nextRowId={null}
              config={config}
              focusedRowId={store.state.revisions[store.state.focusedRevisionIndex]?.rowId ?? null}
              selectedRowIds={new Set()}
              expandedRowId={null}
              commandTargetRowId={null}
            />
          )}
        </For>
      </scrollbox>
      <SearchHighlightLayer
        state={store.state}
        config={config}
        getViewport={() => viewport}
      />
    </box>
  ), { width: 64, height: 6 });

  try {
    await rendered.renderOnce();
    return rendered.captureCharFrame();
  } finally {
    rendered.renderer.destroy();
    store.dispose();
  }
}

async function renderOperationLogSearch(query: string) {
  const store = createAppStore("/tmp/repo", { layout: "loose" });
  const entries: readonly OperationLogEntry[] = [
    {
      id: "op",
      lines: [
        "\u001b[38;5;13margs:\u001b[39m jj rebase -r source -d destination",
      ],
    },
  ];
  store.actions.setOperationLogEntries(entries);
  store.actions.openOperationLog();
  store.actions.openSearch();
  store.actions.setSearchText(query);

  let viewport: ScrollBoxRenderable | undefined;
  const rendered = await testRender(() => (
    <box width={64} height={4} position="relative">
      <scrollbox
        ref={(el: ScrollBoxRenderable) => {
          viewport = el;
        }}
        width="100%"
        height="100%"
        scrollY
      >
        <For each={store.state.operationLogEntries}>
          {(entry, index) => (
            <OperationLogEntryItem
              id={`operation-log-entry-${index()}`}
              entry={entry}
              focused={store.state.focusedOperationLogIndex === index()}
              config={config}
            />
          )}
        </For>
      </scrollbox>
      <SearchHighlightLayer
        state={store.state}
        config={config}
        getViewport={() => viewport}
      />
    </box>
  ), { width: 64, height: 4 });

  try {
    await rendered.renderOnce();
    return {
      frame: rendered.captureCharFrame(),
      highlightTexts: highlightTexts(rendered.captureSpans()),
    };
  } finally {
    rendered.renderer.destroy();
    store.dispose();
  }
}

const description = await renderRevisionSearch("anch");
const bookmark = await renderRevisionSearch("ai");
const visibleRevisionId = await renderRevisionSearch("rr");
const updatedQuery = await renderRevisionSearch("vision");
const inactiveEmoji = await renderInactiveRevisionWithEmoji();
const operationLog = await renderOperationLogSearch("args");

console.log(JSON.stringify({
  description,
  bookmark,
  visibleRevisionId,
  updatedQuery,
  inactiveEmoji,
  operationLog,
}));
