import { For } from "solid-js";
import { testRender } from "@opentui/solid";
import { resolveAppConfig } from "../../src/config/index.ts";
import { createAppStore } from "../../src/state/appStore.ts";
import { draftConfigs, getCommandTargetRowId, getSelectedRowIds } from "../../src/state/store.ts";
import type { RevisionSummary } from "../../src/domain/types.ts";
import { RevisionItem } from "../../src/ui/render.tsx";
import type { AppLayout } from "../../src/domain/types.ts";

function createRevision(
  revisionId: string,
  description: string,
  graphRows: readonly string[],
  overrides: Partial<RevisionSummary> = {},
): RevisionSummary {
  return {
    rowId: revisionId,
    revisionId,
    changeIdPrefixLength: 2,
    commitId: `${revisionId.replace("/", "")}commit`,
    description,
    localTimestamp: "2026-04-15 12:00:00",
    bookmarks: [],
    workspaces: [],
    graphRows,
    isEmpty: false,
    hasConflict: false,
    marker: "plain",
    filesLoaded: false,
    files: [],
    ...overrides,
  };
}

async function renderRevisionStack(
  layout: AppLayout,
  focusedRowId: string | null,
  expandedRowId: string | null = null,
) {
  const revisions = [
    createRevision("prev", "above", ["│ ○  ", "│ │  "]),
    createRevision("curr", "branch", ["│ ○  ", "├─╯  "]),
    createRevision("next", "below", ["○  ", "│  "]),
  ] as const;
  const store = createAppStore("/tmp/repo", { layout });
  store.actions.applyRepositoryData({
    repoPath: "/tmp/repo",
    revisions,
  });
  if (expandedRowId === "curr") {
    store.actions.setRevisionFiles("curr", [{ status: "M", path: "src/layout.ts" }]);
  }

  const rendered = await testRender(() => (
    <box width={32} flexDirection="column">
      <For each={store.state.revisions}>
        {(revision, index) => (
          <RevisionItem
            state={store.state}
            revision={revision}
            index={index()}
            previousRowId={store.state.revisions[index() - 1]?.rowId ?? null}
            nextRowId={store.state.revisions[index() + 1]?.rowId ?? null}
            config={resolveAppConfig({ commands: { layout } })}
            focusedRowId={focusedRowId}
            selectedRowIds={new Set()}
            expandedRowId={expandedRowId}
            commandTargetRowId={null}
            searchQuery=""
          />
        )}
      </For>
    </box>
  ), { width: 32, height: 12 });

  await rendered.renderOnce();
  const frame = rendered.captureCharFrame();
  rendered.renderer.destroy();
  return frame;
}

async function renderLayoutCycleAfterMount() {
  const revisions = [
    createRevision("curr", "branch", ["│ ○  ", "├─╯  "]),
  ] as const;
  const store = createAppStore("/tmp/repo", { layout: "condensed" });
  store.actions.applyRepositoryData({
    repoPath: "/tmp/repo",
    revisions,
  });

  const rendered = await testRender(() => (
    <box width={32} flexDirection="column">
      <RevisionItem
        state={store.state}
        revision={store.state.revisions[0]!}
        index={0}
        previousRowId={null}
        nextRowId={null}
        config={resolveAppConfig({ commands: { layout: "condensed" } })}
        focusedRowId="curr"
        selectedRowIds={new Set()}
        expandedRowId={null}
        commandTargetRowId={null}
        searchQuery=""
      />
    </box>
  ), { width: 32, height: 6 });

  await rendered.renderOnce();
  store.actions.cycleLayout();
  await rendered.renderOnce();
  const frame = rendered.captureCharFrame();
  rendered.renderer.destroy();
  return frame;
}

async function renderLongSuperCondensedDescription() {
  const revisions = [
    createRevision(
      "curr",
      "this is a very long commit message that should truncate instead of wrapping onto a second line",
      ["○  "],
    ),
  ] as const;
  const store = createAppStore("/tmp/repo", { layout: "super-condensed" });
  store.actions.applyRepositoryData({
    repoPath: "/tmp/repo",
    revisions,
  });

  const rendered = await testRender(() => (
    <box width={24} flexDirection="column">
      <RevisionItem
        state={store.state}
        revision={store.state.revisions[0]!}
        index={0}
        previousRowId={null}
        nextRowId={null}
        config={resolveAppConfig({ commands: { layout: "super-condensed" } })}
        focusedRowId="curr"
        selectedRowIds={new Set()}
        expandedRowId={null}
        commandTargetRowId={null}
        searchQuery=""
      />
    </box>
  ), { width: 24, height: 4 });

  await rendered.renderOnce();
  const frame = rendered.captureCharFrame();
  rendered.renderer.destroy();
  return frame;
}

async function renderDivergentFocusedRevision() {
  const revisions = [
    createRevision("shared/0", "older divergent", ["│ ○  ", "│ │  "]),
    createRevision("shared/1", "focused divergent", ["│ ○  ", "├─╯  "]),
    createRevision("next", "below", ["○  ", "│  "]),
  ] as const;
  const store = createAppStore("/tmp/repo", { layout: "condensed" });
  store.actions.applyRepositoryData({
    repoPath: "/tmp/repo",
    revisions,
  });

  const rendered = await testRender(() => (
    <box width={32} flexDirection="column">
      <For each={store.state.revisions}>
        {(revision, index) => (
          <RevisionItem
            state={store.state}
            revision={revision}
            index={index()}
            previousRowId={store.state.revisions[index() - 1]?.rowId ?? null}
            nextRowId={store.state.revisions[index() + 1]?.rowId ?? null}
            config={resolveAppConfig({ commands: { layout: "condensed" } })}
            focusedRowId="shared/1"
            selectedRowIds={new Set()}
            expandedRowId={null}
            commandTargetRowId={null}
            searchQuery=""
          />
        )}
      </For>
    </box>
  ), { width: 32, height: 12 });

  await rendered.renderOnce();
  const frame = rendered.captureCharFrame();
  rendered.renderer.destroy();
  return frame;
}

async function renderExpandedRevisionWithChips() {
  const revisions = [
    createRevision("curr", "branch", ["@  ", "│  "], {
      bookmarks: ["main"],
      workspaces: ["review"],
    }),
  ] as const;
  const store = createAppStore("/tmp/repo", { layout: "expanded" });
  store.actions.applyRepositoryData({
    repoPath: "/tmp/repo",
    revisions,
  });

  const rendered = await testRender(() => (
    <box width={64} flexDirection="column">
      <RevisionItem
        state={store.state}
        revision={store.state.revisions[0]!}
        index={0}
        previousRowId={null}
        nextRowId={null}
        config={resolveAppConfig({ commands: { layout: "expanded" } })}
        focusedRowId={null}
        selectedRowIds={new Set()}
        expandedRowId={null}
        commandTargetRowId={null}
        searchQuery=""
      />
    </box>
  ), { width: 64, height: 6 });

  await rendered.renderOnce();
  const frame = rendered.captureCharFrame();
  rendered.renderer.destroy();
  return frame;
}

async function renderCommandDraftChips(
  layout: AppLayout,
  kind: "rebase" | "squash",
  includeDescendants = false,
) {
  const revisions = [
    createRevision("src", "source revision", ["@  ", "│  "]),
    createRevision("desc", "descendant revision", ["│ ○  ", "│ │  "]),
    createRevision("dst", "destination", ["○  ", "│  "]),
  ] as const;
  const store = createAppStore("/tmp/repo", { layout });
  store.actions.applyRepositoryData({
    repoPath: "/tmp/repo",
    revisions,
  });
  store.actions.startCommandDraft(
    kind === "rebase" ? draftConfigs.rebase : draftConfigs.squash,
    kind === "rebase" ? { descendantRevisionIds: ["src", "desc"] } : undefined,
  );
  store.actions.moveFocus(2);
  if (kind === "rebase" && includeDescendants) {
    store.actions.toggleRebaseDescendants(["src", "desc"]);
  }

  const rendered = await testRender(() => (
    <box width={48} flexDirection="column">
      <For each={store.state.revisions}>
        {(revision, index) => (
          <RevisionItem
            state={store.state}
            revision={revision}
            index={index()}
            previousRowId={store.state.revisions[index() - 1]?.rowId ?? null}
            nextRowId={store.state.revisions[index() + 1]?.rowId ?? null}
            config={resolveAppConfig({ commands: { layout } })}
            focusedRowId={store.state.revisions[store.state.focusedRevisionIndex]?.rowId ?? null}
            selectedRowIds={getSelectedRowIds(store.state)}
            expandedRowId={null}
            commandTargetRowId={getCommandTargetRowId(store.state)}
            searchQuery=""
          />
        )}
      </For>
    </box>
  ), { width: 48, height: 12 });

  await rendered.renderOnce();
  const frame = rendered.captureCharFrame();
  rendered.renderer.destroy();
  return frame;
}

const condensedUnfocused = await renderRevisionStack("condensed", null);
const condensedFocused = await renderRevisionStack("condensed", "curr");
const superCondensed = await renderRevisionStack("super-condensed", "curr");
const superCondensedExpanded = await renderRevisionStack("super-condensed", "curr", "curr");
const cycledToSuperCondensed = await renderLayoutCycleAfterMount();
const longSuperCondensed = await renderLongSuperCondensedDescription();
const divergentFocused = await renderDivergentFocusedRevision();
const expandedChipsInline = await renderExpandedRevisionWithChips();
const rebaseCommandChips = await renderCommandDraftChips("expanded", "rebase");
const rebaseCommandChipsCondensed = await renderCommandDraftChips("condensed", "rebase");
const rebaseCommandChipsSuperCondensed = await renderCommandDraftChips("super-condensed", "rebase");
const rebaseCommandChipsWithDescendants = await renderCommandDraftChips("expanded", "rebase", true);
const squashCommandChips = await renderCommandDraftChips("expanded", "squash");

console.log(JSON.stringify({
  condensedUnfocused,
  condensedFocused,
  superCondensed,
  superCondensedExpanded,
  cycledToSuperCondensed,
  longSuperCondensed,
  divergentFocused,
  expandedChipsInline,
  rebaseCommandChips,
  rebaseCommandChipsCondensed,
  rebaseCommandChipsSuperCondensed,
  rebaseCommandChipsWithDescendants,
  squashCommandChips,
}));
