import { For, Show } from "solid-js";
import type { ScrollBoxRenderable } from "@opentui/core";
import { testRender } from "@opentui/solid";
import { resolveAppConfig } from "../../src/config/index.ts";
import type { RevisionSummary } from "../../src/domain/types.ts";
import { hasVisibleSearchHighlights } from "../../src/search/matching.ts";
import { createAppStore } from "../../src/state/appStore.ts";
import { RevisionItem } from "../../src/ui/render.tsx";
import { SearchPrompt } from "../../src/ui/prompts.tsx";
import { SearchHighlightLayer } from "../../src/ui/searchOverlay.tsx";

const config = resolveAppConfig({ commands: { layout: "loose" } });

function createRevision(index: number): RevisionSummary {
  const id = `r${index}`;
  return {
    rowId: id,
    revisionId: id,
    changeIdPrefixLength: 2,
    commitId: `${id}commit`,
    description: `revision number ${index} match`,
    localTimestamp: "2026-05-06 12:00:00",
    bookmarks: [],
    workspaces: [],
    graphRows: ["@  ", "│  "],
    isEmpty: false,
    hasConflict: false,
    marker: "plain",
    filesLoaded: true,
    files: [],
  } as RevisionSummary;
}

// Scrolls the log with the mouse wheel while a live search (with visible
// highlights) is active, and reports whether the viewport actually moved.
async function scrollDuringSearch() {
  const store = createAppStore("/tmp/repo", { layout: "loose" });
  store.actions.applyRepositoryData({
    repoPath: "/tmp/repo",
    revisions: Array.from({ length: 40 }, (_, i) => createRevision(i)),
  });
  store.actions.openSearch();
  store.actions.setSearchText("match");

  let viewport: ScrollBoxRenderable | undefined;
  const rendered = await testRender(() => (
    <box width={64} height={16} flexDirection="column">
      <scrollbox
        ref={(el: ScrollBoxRenderable) => {
          viewport = el;
        }}
        width="100%"
        flexGrow={1}
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
      <SearchPrompt
        store={store}
        config={config}
        focused={store.state.focusMode === "search"}
        searchQuery={store.state.searchQuery}
        searchIdOnly={store.state.searchIdOnly}
      />
      <Show when={hasVisibleSearchHighlights(store.state)}>
        <SearchHighlightLayer
          state={store.state}
          config={config}
          getViewport={() => viewport}
        />
      </Show>
    </box>
  ), { width: 64, height: 16 });

  try {
    await rendered.renderOnce();
    const vp = viewport!;
    const before = vp.scrollTop;
    // Wheel over the log area (y=3), on top of the full-screen highlight layer.
    await rendered.mockMouse.scroll(5, 3, "down");
    await rendered.renderOnce();
    return {
      hasHighlights: hasVisibleSearchHighlights(store.state),
      maxScroll: vp.scrollHeight - vp.viewport.height,
      before,
      after: vp.scrollTop,
    };
  } finally {
    rendered.renderer.destroy();
    store.dispose();
  }
}

console.log(JSON.stringify(await scrollDuringSearch()));
