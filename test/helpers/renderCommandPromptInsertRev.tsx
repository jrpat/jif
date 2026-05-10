import { testRender } from "@opentui/solid";
import type { InputRenderable } from "@opentui/core";
import { resolveAppConfig } from "../../src/config/index.ts";
import { createAppStore } from "../../src/state/appStore.ts";
import type { RevisionSummary } from "../../src/domain/types.ts";
import { CommandPrompt } from "../../src/ui/prompts.tsx";

const config = resolveAppConfig({});

const REVISIONS: readonly RevisionSummary[] = [
  {
    rowId: "11111111:aaaaaaaa",
    revisionId: "aaaaaaaa",
    parentRevisionIds: [],
    changeIdPrefixLength: 3,
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
    files: [],
  },
  {
    rowId: "22222222:bbbbbbbb",
    revisionId: "bbbbbbbb",
    parentRevisionIds: [],
    changeIdPrefixLength: 4,
    commitId: "22222222",
    description: "second",
    localTimestamp: "2026-03-30 07:22:40",
    bookmarks: [],
    workspaces: [],
    graphRows: ["○  "],
    isEmpty: false,
    hasConflict: false,
    marker: "plain",
    filesLoaded: true,
    files: [],
  },
];

async function flushRender(rendered: Awaited<ReturnType<typeof testRender>>) {
  await rendered.renderOnce();
  await Promise.resolve();
  await rendered.renderOnce();
}

function findInput(rendered: Awaited<ReturnType<typeof testRender>>): InputRenderable {
  const stack: any[] = [(rendered.renderer as any).root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (
      node &&
      typeof node.cursorOffset === "number" &&
      typeof node.plainText === "string"
    ) {
      return node as InputRenderable;
    }
    const children = node?.getChildren?.() ?? node?.children ?? [];
    for (const child of children) {
      stack.push(child);
    }
  }
  throw new Error("InputRenderable not found");
}

async function runCase(prefix: "jj " | "❯ ", focus: "jj" | "shell") {
  const store = createAppStore("/tmp/repo");
  store.actions.applyRepositoryData({ repoPath: "/tmp/repo", revisions: REVISIONS });
  store.actions.focusRevisionAt(1);
  if (focus === "shell") {
    store.actions.focusShellCommandBar();
  } else {
    store.actions.focusCommandBar();
  }
  store.actions.setCommandBarText("rebase -d ");

  const rendered = await testRender(() => (
    <CommandPrompt
      store={store}
      config={config}
      workspaceRoot="/tmp/repo"
      loadHistory={async () => []}
      commandText={store.state.commandBar.text}
      prefix={prefix}
      placeholder="subcommand"
      onSubmit={() => {}}
    />
  ), { width: 80, height: 12, kittyKeyboard: true });

  try {
    await flushRender(rendered);

    const input = findInput(rendered);
    input.cursorOffset = input.plainText.length;

    rendered.mockInput.pressKey("'", { ctrl: true });
    await flushRender(rendered);

    const afterFirstInsert = { plainText: input.plainText, cursorOffset: input.cursorOffset };

    rendered.mockInput.pressArrow("left");
    rendered.mockInput.pressArrow("left");
    rendered.mockInput.pressArrow("left");
    rendered.mockInput.pressArrow("left");
    await flushRender(rendered);

    rendered.mockInput.pressKey("'", { ctrl: true });
    await flushRender(rendered);
    const afterMidInsert = { plainText: input.plainText, cursorOffset: input.cursorOffset };

    return { afterFirstInsert, afterMidInsert, storeText: store.state.commandBar.text };
  } finally {
    rendered.renderer.destroy();
    store.dispose();
  }
}

async function run() {
  const jj = await runCase("jj ", "jj");
  const shell = await runCase("❯ ", "shell");
  console.log(JSON.stringify({ jj, shell }));
}

await run();
