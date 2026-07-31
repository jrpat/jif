import { describe, expect, test } from "bun:test";
import type { AppState } from "../src/domain/types.ts";
import { createRowId } from "../src/domain/rowIds.ts";
import {
  commandCanExecute,
  createInitialState,
  cycleDiffRangeKind,
  draftConfigs,
  getCommandChipTextForRevision,
  getCommandTargetRowId,
  getDisplayedCommandText,
  getOperationAffectedRowIds,
  startCommandDraft,
  toggleDiffDescendants,
} from "../src/state/store.ts";
import { defaultKeymap, getActiveMode, resolveCommand } from "../src/modes.ts";

const TOP = createRowId("11111111", "aaaaaaaa");
const MIDDLE = createRowId("22222222", "bbbbbbbb");
const BOTTOM = createRowId("33333333", "cccccccc");

function createState(): AppState {
  const revision = (rowId: string, commitId: string, revisionId: string) => ({
    rowId,
    revisionId,
    parentRevisionIds: [],
    changeIdPrefixLength: 4,
    commitId,
    description: revisionId,
    localTimestamp: "2026-03-30 07:22:39",
    bookmarks: [],
    workspaces: [],
    graphRows: ["○  "],
    isEmpty: false,
    hasConflict: false,
    marker: "plain" as const,
    filesLoaded: false,
    files: [],
  });

  return {
    ...createInitialState("/tmp/repo"),
    loading: false,
    revisions: [
      revision(TOP, "11111111", "aaaaaaaa"),
      revision(MIDDLE, "22222222", "bbbbbbbb"),
      revision(BOTTOM, "33333333", "cccccccc"),
    ],
  };
}

// ctrl+d starts on the bottom revision and moves the cursor up one row, so the
// source is the older revision and the cursor lands on its descendant.
function startDiff(): AppState {
  return startCommandDraft(
    { ...createState(), focusedRevisionIndex: 2 },
    draftConfigs.diff,
    { focusDirection: "up" },
  );
}

describe("diff draft range composition", () => {
  test("ctrl-d composes an inclusive A::B range by default", () => {
    const state = startDiff();
    expect(getActiveMode(state)).toBe("diff");
    expect(state.commandDraft?.diffRangeKind ?? "range").toBe("range");
    expect(getDisplayedCommandText(state)).toBe("diff -r cccc::bbbb");
  });

  test("the source revision moves up so the cursor starts on a descendant", () => {
    expect(startDiff().focusedRevisionIndex).toBe(1);
  });

  test("= cycles to the exclusive --from/--to comparison and back", () => {
    expect(resolveCommand("diff", "=", defaultKeymap)).toBe("diff-cycle-range-kind");

    const between = cycleDiffRangeKind(startDiff());
    expect(between.commandDraft?.diffRangeKind).toBe("between");
    expect(getDisplayedCommandText(between)).toBe("diff -f cccc -t bbbb");

    const back = cycleDiffRangeKind(between);
    expect(back.commandDraft?.diffRangeKind).toBe("range");
    expect(getDisplayedCommandText(back)).toBe("diff -r cccc::bbbb");
  });

  test("s extends the range over every descendant and drops the target", () => {
    expect(resolveCommand("diff", "s", defaultKeymap)).toBe("diff-descendants");

    const descendants = toggleDiffDescendants(startDiff());
    expect(descendants.commandDraft?.diffRangeKind).toBe("descendants");
    expect(getDisplayedCommandText(descendants)).toBe("diff -r cccc::");
    expect(getCommandTargetRowId(descendants)).toBeNull();

    expect(toggleDiffDescendants(descendants).commandDraft?.diffRangeKind).toBe("range");
  });

  test("a descendants range is runnable even though it has no target", () => {
    const descendants = toggleDiffDescendants(startDiff());
    expect(getCommandTargetRowId(descendants)).toBeNull();
    expect(commandCanExecute(descendants)).toBeTrue();

    // The other kinds still need the cursor to have picked an endpoint.
    const noTarget = { ...startDiff(), selectedRowIds: [BOTTOM], focusedRevisionIndex: 2 };
    expect(commandCanExecute(noTarget)).toBeFalse();
  });

  test("= leaves descendants mode, which --from/--to cannot express", () => {
    const state = cycleDiffRangeKind(toggleDiffDescendants(startDiff()));
    expect(state.commandDraft?.diffRangeKind).toBe("between");
    expect(getDisplayedCommandText(state)).toBe("diff -f cccc -t bbbb");
  });

  test("chips name the range endpoints so inclusivity is legible", () => {
    const range = startDiff();
    expect(getCommandChipTextForRevision(range, BOTTOM)).toBe("first");
    expect(getCommandChipTextForRevision(range, MIDDLE)).toBe("last");

    const between = cycleDiffRangeKind(range);
    expect(getCommandChipTextForRevision(between, BOTTOM)).toBe("from");
    expect(getCommandChipTextForRevision(between, MIDDLE)).toBe("to");

    const descendants = toggleDiffDescendants(range);
    expect(getCommandChipTextForRevision(descendants, BOTTOM)).toBe("first");
    expect(getCommandChipTextForRevision(descendants, MIDDLE)).toBeNull();
  });

  test("descendants mode highlights the revisions it will fold together", () => {
    const descendants = {
      ...toggleDiffDescendants(startDiff()),
      commandDraft: {
        config: draftConfigs.diff,
        diffRangeKind: "descendants" as const,
        descendantRevisionIds: ["cccccccc", "bbbbbbbb", "aaaaaaaa"],
      },
      selectedRowIds: [BOTTOM],
    };
    expect(getOperationAffectedRowIds(descendants)).toEqual(new Set([BOTTOM, MIDDLE, TOP]));
  });

  test("several sources union into one revset root", () => {
    const state = {
      ...startDiff(),
      selectedRowIds: [BOTTOM, MIDDLE],
      focusedRevisionIndex: 0,
    };
    expect(getDisplayedCommandText(state)).toBe("diff -r (cccc|bbbb)::aaaa");
    expect(getDisplayedCommandText(toggleDiffDescendants(state))).toBe("diff -r (cccc|bbbb)::");
  });

  test("the range form survives long flag names", () => {
    const longFlags = { ...startDiff(), useShortFlags: false };
    expect(getDisplayedCommandText(longFlags)).toBe("diff --revisions cccc::bbbb");
    expect(getDisplayedCommandText(cycleDiffRangeKind(longFlags))).toBe("diff --from cccc --to bbbb");
  });
});
