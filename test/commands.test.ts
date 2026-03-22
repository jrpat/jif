import { expect, test } from "bun:test";
import { getTextCommand } from "../src/commands/definitions.ts";
import type { AppState } from "../src/domain/types.ts";
import { createInitialState, startRebaseCommand } from "../src/state/store.ts";

function createState(): AppState {
  return {
    ...createInitialState("/tmp/repo"),
    loading: false,
    revisions: [
      {
        changeId: "aaaaaaaa",
        changeIdPrefixLength: 1,
        commitId: "11111111",
        description: "first",
        bookmarks: [],
        workspaces: [],
        graphHead: "@  ",
        graphTail: [],
        marker: "working-copy",
        files: [],
      },
    ],
  };
}

test("getTextCommand resolves vim navigation when command bar is unfocused", () => {
  const state = createState();

  expect(getTextCommand("j", state)?.id).toBe("move-down");
  expect(getTextCommand("k", state)?.id).toBe("move-up");
  expect(getTextCommand("h", state)?.id).toBe("collapse");
  expect(getTextCommand("l", state)?.id).toBe("expand");
  expect(getTextCommand("q", state)?.id).toBe("quit");
});

test("getTextCommand respects command visibility state", () => {
  const focusedState = {
    ...createState(),
    focusMode: "command" as const,
    commandBar: {
      ...createState().commandBar,
      manual: true,
    },
  };
  expect(getTextCommand("j", focusedState)).toBeNull();

  const rebaseState = startRebaseCommand(createState(), ["aaaaaaaa"]);
  expect(getTextCommand("s", createState())).toBeNull();
  expect(getTextCommand("s", rebaseState)?.id).toBe("rebase-descendants");
});
