import { expect, mock, test } from "bun:test";
import * as realFs from "node:fs";
import { createUserAppState } from "../src/config/keymap.ts";
import { createInitialState } from "../src/state/store.ts";
import type { AppState, RevisionSummary } from "../src/domain/types.ts";

// The VS Code config override emits its IPC by writing directly to fd 1 via
// `node:fs.writeSync` (it bypasses OpenTUI's stdout capture). Intercept that
// write so we can inspect the emitted APC payloads.
const ipcWrites: string[] = [];
mock.module("node:fs", () => ({
  ...realFs,
  default: (realFs as { default?: unknown }).default ?? realFs,
  writeSync: (_fd: number, data: string) => {
    ipcWrites.push(String(data));
    return String(data).length;
  },
}));

const IPC_PATTERN = /^\x1b_jif-vscode:(.*)\x1b\\$/s;

function parseIpc(): unknown[] {
  return ipcWrites.map((raw) => {
    const match = raw.match(IPC_PATTERN);
    if (!match) {
      throw new Error(`Write was not a jif-vscode APC sequence: ${JSON.stringify(raw)}`);
    }
    return JSON.parse(match[1]!);
  });
}

async function loadOverride() {
  return (await import("../ext/vscode/assets/jif-vscode.config.ts")).default;
}

function makeRevision(over: Partial<RevisionSummary> = {}): RevisionSummary {
  return {
    rowId: "aaaaaaaa",
    revisionId: "aaaaaaaa",
    parentRevisionIds: [],
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
    filesLoaded: true,
    files: [{ path: "src/app.ts", status: "M" }],
    ...over,
  };
}

function makeState(over: Partial<AppState> = {}): AppState {
  return {
    ...createInitialState("/tmp/repo"),
    loading: false,
    revisions: [makeRevision()],
    focusedRevisionIndex: 0,
    expandedRowId: "aaaaaaaa",
    focusedFileIndex: 0,
    ...over,
  };
}

test("normal-mode d emits a diff-revision IPC carrying the focused revision id", async () => {
  ipcWrites.length = 0;
  const config = await loadOverride();
  const state = createUserAppState(makeState());

  config.keymap.normal.d.run(undefined, state);

  const messages = parseIpc();
  expect(messages).toEqual([{ kind: "diff-revision", revisionId: "aaaaaaaa" }]);
  // The extension's isIpcMessage drops the payload unless revisionId is a string.
  expect(typeof (messages[0] as { revisionId: unknown }).revisionId).toBe("string");
});

test("files-mode d emits a diff-file IPC carrying the focused revision id and file path", async () => {
  ipcWrites.length = 0;
  const config = await loadOverride();
  const state = createUserAppState(makeState());

  config.keymap.files.d.run(undefined, state);

  const messages = parseIpc();
  expect(messages).toEqual([
    { kind: "diff-file", revisionId: "aaaaaaaa", path: "src/app.ts" },
  ]);
  const message = messages[0] as { revisionId: unknown; path: unknown };
  expect(typeof message.revisionId).toBe("string");
  expect(typeof message.path).toBe("string");
});

test("normal-mode d canExecute is true for a real row and false for an elided one", async () => {
  const config = await loadOverride();

  const onReal = createUserAppState(makeState());
  expect(config.keymap.normal.d.canExecute(onReal)).toBe(true);

  const onElided = createUserAppState(
    makeState({ revisions: [makeRevision({ marker: "elided" })] }),
  );
  expect(config.keymap.normal.d.canExecute(onElided)).toBe(false);
});

test("normal-mode d emits nothing when no revision is focused", async () => {
  ipcWrites.length = 0;
  const config = await loadOverride();
  const state = createUserAppState(makeState({ revisions: [], focusedRevisionIndex: 0 }));

  config.keymap.normal.d.run(undefined, state);

  expect(ipcWrites).toEqual([]);
});
