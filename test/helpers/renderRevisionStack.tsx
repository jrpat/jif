import { For, createSignal } from "solid-js";
import { testRender } from "@opentui/solid";
import { resolveAppConfig } from "../../src/config/index.ts";
import { createAppStore } from "../../src/state/appStore.ts";
import { draftConfigs, getCommandTargetRowId, getMarkedRowIds } from "../../src/state/store.ts";
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
    localTimestamp: "",
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
  const store = createAppStore("/tmp/repo", { layout: "normal" });
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
        config={resolveAppConfig({ commands: { layout: "normal" } })}
        focusedRowId="curr"
        selectedRowIds={new Set()}
        expandedRowId={null}
        commandTargetRowId={null}
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
  const store = createAppStore("/tmp/repo", { layout: "tight" });
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
        config={resolveAppConfig({ commands: { layout: "tight" } })}
        focusedRowId="curr"
        selectedRowIds={new Set()}
        expandedRowId={null}
        commandTargetRowId={null}
      />
    </box>
  ), { width: 24, height: 4 });

  await rendered.renderOnce();
  const frame = rendered.captureCharFrame();
  rendered.renderer.destroy();
  return frame;
}

async function renderLongSuperCondensedDescriptionAfterResize() {
  const revisions = [
    createRevision(
      "curr",
      "this is a very long commit message that should truncate instead of wrapping onto a second line",
      ["○  "],
    ),
  ] as const;
  const store = createAppStore("/tmp/repo", { layout: "tight" });
  store.actions.applyRepositoryData({
    repoPath: "/tmp/repo",
    revisions,
  });
  const [width, setWidth] = createSignal(24);

  const rendered = await testRender(() => (
    <box width={width()} flexDirection="column">
      <RevisionItem
        state={store.state}
        revision={store.state.revisions[0]!}
        index={0}
        previousRowId={null}
        nextRowId={null}
        config={resolveAppConfig({ commands: { layout: "tight" } })}
        focusedRowId="curr"
        selectedRowIds={new Set()}
        expandedRowId={null}
        commandTargetRowId={null}
      />
    </box>
  ), { width: 24, height: 4 });

  await rendered.renderOnce();
  const initialFrame = rendered.captureCharFrame();
  setWidth(40);
  rendered.renderer.width = 40;
  rendered.renderer.height = 4;
  await rendered.renderOnce();
  const resizedFrame = rendered.captureCharFrame();
  rendered.renderer.destroy();

  return {
    initialFrame,
    resizedFrame,
  };
}

async function renderDateChipWithLongDescription(layout: AppLayout) {
  const revisions = [
    createRevision(
      "curr",
      "this is a very long commit message that should not push the date chip off the right edge",
      ["@  "],
      { localTimestamp: "2020-01-01 00:00:00", marker: "working-copy" },
    ),
  ] as const;
  const store = createAppStore("/tmp/repo", { layout });
  store.actions.applyRepositoryData({
    repoPath: "/tmp/repo",
    revisions,
  });

  const rendered = await testRender(() => (
    <box width={40} flexDirection="column">
      <RevisionItem
        state={store.state}
        revision={store.state.revisions[0]!}
        index={0}
        previousRowId={null}
        nextRowId={null}
        config={resolveAppConfig({ commands: { layout } })}
        focusedRowId="curr"
        selectedRowIds={new Set()}
        expandedRowId={null}
        commandTargetRowId={null}
      />
    </box>
  ), { width: 40, height: layout === "loose" ? 4 : 3 });

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
  const store = createAppStore("/tmp/repo", { layout: "normal" });
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
            config={resolveAppConfig({ commands: { layout: "normal" } })}
            focusedRowId="shared/1"
            selectedRowIds={new Set()}
            expandedRowId={null}
            commandTargetRowId={null}
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
  const store = createAppStore("/tmp/repo", { layout: "loose" });
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
        config={resolveAppConfig({ commands: { layout: "loose" } })}
        focusedRowId={null}
        selectedRowIds={new Set()}
        expandedRowId={null}
        commandTargetRowId={null}
      />
    </box>
  ), { width: 64, height: 6 });

  await rendered.renderOnce();
  const frame = rendered.captureCharFrame();
  rendered.renderer.destroy();
  return frame;
}

async function renderBookmarkChipAfterRefresh(layout: AppLayout) {
  const initialRevisions = [
    createRevision("src", "source revision", ["│ ○  ", "│ │  "], {
      bookmarks: ["main"],
    }),
    createRevision("dst", "destination revision", ["○  ", "│  "]),
  ] as const;
  const refreshedRevisions = [
    createRevision("src", "source revision", ["│ ○  ", "│ │  "], {
      bookmarks: [],
    }),
    createRevision("dst", "destination revision", ["○  ", "│  "], {
      bookmarks: ["main"],
    }),
  ] as const;
  const store = createAppStore("/tmp/repo", { layout });
  store.actions.applyRepositoryData({
    repoPath: "/tmp/repo",
    revisions: initialRevisions,
  });

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
            focusedRowId={null}
            selectedRowIds={new Set()}
            expandedRowId={null}
            commandTargetRowId={null}
          />
        )}
      </For>
    </box>
  ), { width: 48, height: 8 });

  await rendered.renderOnce();
  const initialFrame = rendered.captureCharFrame();
  store.actions.applyRepositoryData({
    repoPath: "/tmp/repo",
    revisions: refreshedRevisions,
  });
  await rendered.renderOnce();
  const refreshedFrame = rendered.captureCharFrame();
  rendered.renderer.destroy();

  return {
    initialFrame,
    refreshedFrame,
  };
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
            selectedRowIds={getMarkedRowIds(store.state)}
            expandedRowId={null}
            commandTargetRowId={getCommandTargetRowId(store.state)}
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

const normalUnfocused = await renderRevisionStack("normal", null);
const normalFocused = await renderRevisionStack("normal", "curr");
const tight = await renderRevisionStack("tight", "curr");
const tightExpanded = await renderRevisionStack("tight", "curr", "curr");
const cycledToTight = await renderLayoutCycleAfterMount();
const longTight = await renderLongSuperCondensedDescription();
const resizedLongTight = await renderLongSuperCondensedDescriptionAfterResize();
const divergentFocused = await renderDivergentFocusedRevision();
const looseChipsInline = await renderExpandedRevisionWithChips();
const looseBookmarkChipRefresh = await renderBookmarkChipAfterRefresh("loose");
const rebaseCommandChips = await renderCommandDraftChips("loose", "rebase");
const rebaseCommandChipsNormal = await renderCommandDraftChips("normal", "rebase");
const rebaseCommandChipsTight = await renderCommandDraftChips("tight", "rebase");
const rebaseCommandChipsWithDescendants = await renderCommandDraftChips("loose", "rebase", true);
const squashCommandChips = await renderCommandDraftChips("loose", "squash");
const dateChipLongDescriptionLoose = await renderDateChipWithLongDescription("loose");
const dateChipLongDescriptionNormal = await renderDateChipWithLongDescription("normal");
const dateChipLongDescriptionTight = await renderDateChipWithLongDescription("tight");

console.log(JSON.stringify({
  normalUnfocused,
  normalFocused,
  tight,
  tightExpanded,
  cycledToTight,
  longTight,
  resizedLongTight,
  divergentFocused,
  looseChipsInline,
  looseBookmarkChipRefresh,
  rebaseCommandChips,
  rebaseCommandChipsNormal,
  rebaseCommandChipsTight,
  rebaseCommandChipsWithDescendants,
  squashCommandChips,
  dateChipLongDescriptionLoose,
  dateChipLongDescriptionNormal,
  dateChipLongDescriptionTight,
}));
