import { testRender } from "@opentui/solid";
import { resolveAppConfig } from "../../src/config/index.ts";
import { createRowId } from "../../src/domain/rowIds.ts";
import type { RevisionSummary } from "../../src/domain/types.ts";
import { createAppStore, type AppStore } from "../../src/state/appStore.ts";
import { RevisionItem } from "../../src/ui/render.tsx";

const ROW_ID = createRowId("11111111", "aaaaaaaa");

const REVISION: RevisionSummary = {
  rowId: ROW_ID,
  revisionId: "aaaaaaaa",
  changeIdPrefixLength: 1,
  commitId: "11111111",
  description: "first",
  localTimestamp: "2026-03-30 07:22:39",
  bookmarks: [],
  workspaces: [],
  graphRows: ["@  "],
  isEmpty: false,
  hasConflict: false,
  marker: "working-copy",
  filesLoaded: false,
  files: [],
};

function createStore(): AppStore {
  const store = createAppStore("/tmp/repo", { layout: "loose" });
  store.actions.applyRepositoryData({ repoPath: "/tmp/repo", revisions: [REVISION] });
  store.actions.setRevisionFiles(ROW_ID, [
    { status: "M", path: "src/ui/render.tsx" },
    { status: "M", path: "src/state/store.ts" },
    { status: "A", path: "test/render.test.ts" },
  ]);
  store.actions.openFocusedRevision();
  return store;
}

async function renderExpandedFiles(drive: (store: AppStore) => void) {
  const store = createStore();
  const config = resolveAppConfig({ commands: { layout: "loose" } });

  const rendered = await testRender(() => (
    <box width={44} flexDirection="column">
      <RevisionItem
        fileFilterActions={store.actions}
        state={store.state}
        revision={store.state.revisions[0]!}
        index={0}
        previousRowId={null}
        nextRowId={null}
        config={config}
        focusedRowId={ROW_ID}
        selectedRowIds={new Set()}
        expandedRowId={ROW_ID}
        commandTargetRowId={null}
      />
    </box>
  ), { width: 44, height: 14 });

  await rendered.renderOnce();
  drive(store);
  await rendered.renderOnce();

  const frame = rendered.captureCharFrame();
  const spans = rendered.captureSpans();
  rendered.renderer.destroy();
  return { frame, spans, focusMode: store.state.focusMode };
}

function findSpans(
  spans: Awaited<ReturnType<typeof renderExpandedFiles>>["spans"],
  lineText: string,
) {
  const line = spans.lines.find((candidate) =>
    candidate.spans.map((span) => span.text).join("").includes(lineText)
  );
  if (!line) {
    throw new Error(`Expected a rendered line containing ${lineText}.`);
  }

  return line.spans.map((span) => ({
    text: span.text,
    fg: span.fg.toInts(),
    bg: span.bg.toInts(),
  }));
}

const unfiltered = await renderExpandedFiles(() => {});
const opened = await renderExpandedFiles((store) => {
  store.actions.openFileFilter();
});
const typed = await renderExpandedFiles((store) => {
  store.actions.openFileFilter();
  store.actions.setFileFilterText("render");
});
const noMatches = await renderExpandedFiles((store) => {
  store.actions.openFileFilter();
  store.actions.setFileFilterText("nothing-here");
});
const committed = await renderExpandedFiles((store) => {
  store.actions.openFileFilter();
  store.actions.setFileFilterText("render");
  store.actions.finalizeFileFilter();
});
const highlighted = await renderExpandedFiles((store) => {
  store.actions.openFileFilter();
  store.actions.setFileFilterText("state");
});

console.log(JSON.stringify({
  unfiltered: unfiltered.frame,
  opened: opened.frame,
  typed: typed.frame,
  noMatches: noMatches.frame,
  committed: { frame: committed.frame, focusMode: committed.focusMode },
  highlightedSpans: findSpans(highlighted.spans, "src/state/store.ts"),
}));
