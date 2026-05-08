import { describe, expect, test } from "bun:test";
import type { AppState } from "../src/domain/types.ts";
import { createRowId } from "../src/domain/rowIds.ts";
import {
  cancelOrBlurState,
  createInitialState,
  draftConfigs,
  enterBookmarkLeader,
  exitBookmarkLeader,
  getCommandChipTextForRevision,
  getDisplayedCommandText,
  startBookmarkPrompt,
  startCommandDraft,
} from "../src/state/store.ts";
import { getActiveMode } from "../src/modes.ts";

const ROW_ONE = createRowId("11111111", "aaaaaaaa");
const ROW_TWO = createRowId("22222222", "bbbbbbbb");
const ROW_THREE = createRowId("33333333", "cccccccc");

function createState(): AppState {
  return {
    ...createInitialState("/tmp/repo"),
    loading: false,
    focusedRevisionIndex: 1,
    revisions: [
      {
        rowId: ROW_ONE,
        revisionId: "aaaaaaaa",
        parentRevisionIds: ["bbbbbbbb"],
        changeIdPrefixLength: 1,
        commitId: "11111111",
        description: "newer",
        localTimestamp: "2026-03-30 07:22:39",
        bookmarks: [],
        workspaces: [],
        graphRows: ["@  "],
        isEmpty: false,
        hasConflict: false,
        marker: "working-copy",
        filesLoaded: true,
        files: [],
      },
      {
        rowId: ROW_TWO,
        revisionId: "bbbbbbbb",
        parentRevisionIds: ["cccccccc"],
        changeIdPrefixLength: 1,
        commitId: "22222222",
        description: "middle",
        localTimestamp: "2026-03-30 07:22:38",
        bookmarks: ["main"],
        workspaces: [],
        graphRows: ["○  "],
        isEmpty: false,
        hasConflict: false,
        marker: "plain",
        filesLoaded: true,
        files: [],
      },
      {
        rowId: ROW_THREE,
        revisionId: "cccccccc",
        parentRevisionIds: [],
        changeIdPrefixLength: 1,
        commitId: "33333333",
        description: "older",
        localTimestamp: "2026-03-30 07:22:37",
        bookmarks: [],
        workspaces: [],
        graphRows: ["○  "],
        isEmpty: false,
        hasConflict: false,
        marker: "plain",
        filesLoaded: true,
        files: [],
      },
    ],
  };
}

describe("bookmark leader mode", () => {
  test("enterBookmarkLeader switches getActiveMode to 'bookmark'", () => {
    const state = enterBookmarkLeader(createState());
    expect(state.focusMode).toBe("bookmark");
    expect(getActiveMode(state)).toBe("bookmark");
  });

  test("exitBookmarkLeader returns to revisions focus mode", () => {
    const entered = enterBookmarkLeader(createState());
    const exited = exitBookmarkLeader(entered);
    expect(exited.focusMode).toBe("revisions");
    expect(getActiveMode(exited)).toBe("normal");
  });

  test("cancelOrBlurState exits bookmark leader without affecting other state", () => {
    const entered = enterBookmarkLeader(createState());
    const cancelled = cancelOrBlurState(entered);
    expect(cancelled.focusMode).toBe("revisions");
  });

  test("escape from bookmark-move clears the draft AND exits bookmark leader in one step", () => {
    const entered = enterBookmarkLeader(createState());
    const moveDraft = startCommandDraft(entered, draftConfigs["bookmark-move-from"], {
      focusDirection: "up",
    });
    expect(moveDraft.commandDraft?.config.kind).toBe("bookmark-move");
    expect(moveDraft.focusMode).toBe("bookmark");
    expect(getActiveMode(moveDraft)).toBe("bookmark-move");

    const cancelled = cancelOrBlurState(moveDraft);
    expect(cancelled.commandDraft).toBeNull();
    expect(cancelled.focusMode).toBe("revisions");
    expect(getActiveMode(cancelled)).toBe("normal");
  });

  test("startBookmarkPrompt focuses the command bar with prefilled text and bookmark context", () => {
    const state = startBookmarkPrompt(
      enterBookmarkLeader(createState()),
      "b move  -t b",
      "b move ".length,
      {
        focusedRevisionId: "bbbbbbbb",
        suggestions: [
          { name: "main", targetChangeId: "ancestor1", bucket: "behind", distance: 1 },
        ],
      },
    );

    expect(state.focusMode).toBe("command");
    expect(state.commandBar.manual).toBe(true);
    expect(state.commandBar.text).toBe("b move  -t b");
    expect(state.commandBarBookmark).not.toBeNull();
    expect(state.commandBarBookmark?.initialCursorOffset).toBe(7);
    expect(state.commandBarBookmark?.suggestions).toHaveLength(1);
  });

  test("startBookmarkPrompt without suggestions clears the bookmark context", () => {
    const state = startBookmarkPrompt(
      enterBookmarkLeader(createState()),
      "b move  -t b",
      "b move ".length,
      {
        focusedRevisionId: "bbbbbbbb",
        suggestions: null,
      },
    );

    expect(state.commandBarBookmark).toBeNull();
  });

  test("startBookmarkPrompt with empty suggestions preserves cursor offset", () => {
    const state = startBookmarkPrompt(
      enterBookmarkLeader(createState()),
      "b create  -r b",
      "b create ".length,
      {
        focusedRevisionId: "bbbbbbbb",
        suggestions: [],
      },
    );

    expect(state.commandBarBookmark).not.toBeNull();
    expect(state.commandBarBookmark?.initialCursorOffset).toBe("b create ".length);
    expect(state.commandBarBookmark?.suggestions).toHaveLength(0);
  });

  test("cancelling a bookmark prompt clears commandBarBookmark", () => {
    const opened = startBookmarkPrompt(
      enterBookmarkLeader(createState()),
      "b delete ",
      "b delete ".length,
      {
        focusedRevisionId: "bbbbbbbb",
        suggestions: [],
      },
    );
    const cancelled = cancelOrBlurState(opened);
    expect(cancelled.commandBarBookmark).toBeNull();
    expect(cancelled.commandBar.text).toBe("");
  });
});

describe("bookmark-move-from draft", () => {
  test("startCommandDraft moves focus up when focusDirection is 'up'", () => {
    const initial = createState();
    const drafted = startCommandDraft(initial, draftConfigs["bookmark-move-from"], {
      focusDirection: "up",
    });

    expect(drafted.focusedRevisionIndex).toBe(0);
    expect(drafted.selectedRowIds).toEqual([ROW_TWO]);
    expect(drafted.commandDraft?.config.kind).toBe("bookmark-move");
    expect(getActiveMode(drafted)).toBe("bookmark-move");
  });

  test("chip text labels selected as 'from' and focused as 'to'", () => {
    const drafted = startCommandDraft(createState(), draftConfigs["bookmark-move-from"], {
      focusDirection: "up",
    });

    expect(getCommandChipTextForRevision(drafted, ROW_TWO)).toBe("from");
    expect(getCommandChipTextForRevision(drafted, ROW_ONE)).toBe("to");
  });

  test("template renders with short flags by default", () => {
    const drafted = startCommandDraft(createState(), draftConfigs["bookmark-move-from"], {
      focusDirection: "up",
    });

    const command = getDisplayedCommandText(drafted);
    expect(command).toBe("b move -f b -t a");
  });

  test("template renders with long flags when shortFlags disabled", () => {
    const initial: AppState = { ...createState(), useShortFlags: false };
    const drafted = startCommandDraft(initial, draftConfigs["bookmark-move-from"], {
      focusDirection: "up",
    });

    const command = getDisplayedCommandText(drafted);
    expect(command).toBe("b move --from b --to a");
  });
});
