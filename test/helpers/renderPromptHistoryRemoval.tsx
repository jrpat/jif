import { testRender } from "@opentui/solid";
import { createSignal } from "solid-js";
import { resolveAppConfig } from "../../src/config/index.ts";
import type { JjClient } from "../../src/jj/client.ts";
import type { AppStore } from "../../src/state/appStore.ts";
import type { BookmarkSuggestion } from "../../src/domain/types.ts";
import { CommandPrompt, RevsetPrompt } from "../../src/ui/prompts.tsx";

const config = resolveAppConfig({});

async function flushRender(rendered: Awaited<ReturnType<typeof testRender>>) {
  await rendered.renderOnce();
  await Promise.resolve();
  await rendered.renderOnce();
}

function capturePromptLine(rendered: Awaited<ReturnType<typeof testRender>>): string {
  const lines = rendered.captureCharFrame().split("\n");
  return lines.find((line) => line.includes("│")) ?? "";
}

function autocompleteLines(rendered: Awaited<ReturnType<typeof testRender>>): string[] {
  return rendered.captureCharFrame().split("\n").filter((line) => !line.includes("│"));
}

async function renderCommandPromptHistoryRemoval() {
  const initialHistory = ["zzalpha", "zzbeta", "zzgamma"] as const;
  const removed: string[] = [];

  const rendered = await testRender(() => {
    const [text, setText] = createSignal("");
    const store = {
      actions: { setCommandBarText: setText },
    } as unknown as AppStore;

    return (
      <CommandPrompt
        store={store}
        config={config}
        workspaceRoot="/repo"
        loadHistory={async () => [...initialHistory]}
        removeHistory={async (_root, entry) => {
          removed.push(entry);
          return [];
        }}
        commandText={text()}
        prefix="jj "
        placeholder="subcommand"
        onSubmit={() => {}}
      />
    );
  }, { width: 80, height: 12, kittyKeyboard: true });

  try {
    await flushRender(rendered);

    rendered.mockInput.pressArrow("up");
    rendered.mockInput.pressArrow("up");
    rendered.mockInput.pressArrow("up");
    await flushRender(rendered);
    const beforeRemove = autocompleteLines(rendered).join("\n");

    rendered.mockInput.pressKey("x", { ctrl: true });
    await flushRender(rendered);
    const afterRemove = autocompleteLines(rendered).join("\n");
    const promptAfterRemove = capturePromptLine(rendered);

    return { beforeRemove, afterRemove, promptAfterRemove, removed: [...removed] };
  } finally {
    rendered.renderer.destroy();
  }
}

async function renderBookmarkPromptIgnoresCtrlX() {
  const suggestions: readonly BookmarkSuggestion[] = [
    { name: "feature-a", targetChangeId: "a", bucket: "current", distance: 0 },
    { name: "feature-b", targetChangeId: "b", bucket: "current", distance: 0 },
  ];
  const removed: string[] = [];

  const rendered = await testRender(() => {
    const [text, setText] = createSignal("");
    const store = {
      actions: { setCommandBarText: setText },
    } as unknown as AppStore;

    return (
      <CommandPrompt
        store={store}
        config={config}
        workspaceRoot="/repo"
        loadHistory={async () => []}
        removeHistory={async (_root, entry) => {
          removed.push(entry);
          return [];
        }}
        commandText={text()}
        prefix="jj "
        placeholder="subcommand"
        onSubmit={() => {}}
        bookmarkContext={{ initialCursorOffset: 0, suggestions }}
      />
    );
  }, { width: 80, height: 12, kittyKeyboard: true });

  try {
    await flushRender(rendered);

    rendered.mockInput.pressArrow("up");
    await flushRender(rendered);
    const beforeRemove = autocompleteLines(rendered).join("\n");

    rendered.mockInput.pressKey("x", { ctrl: true });
    await flushRender(rendered);
    const afterRemove = autocompleteLines(rendered).join("\n");

    return { beforeRemove, afterRemove, removed: [...removed] };
  } finally {
    rendered.renderer.destroy();
  }
}

async function renderRevsetPromptHistoryRemoval() {
  const initialHistory = ["aaa()", "bbb()", "ccc()"] as const;
  const removed: string[] = [];
  const client = {
    loadBookmarks: async () => [],
    loadTags: async () => [],
    loadAliases: async () => ({}),
  } as unknown as JjClient;

  const rendered = await testRender(() => (
    <RevsetPrompt
      revsetQuery=""
      client={client}
      config={config}
      workspaceRoot="/repo"
      loadHistory={async () => [...initialHistory]}
      removeHistory={async (_root, entry) => {
        removed.push(entry);
        return [];
      }}
      onApply={() => {}}
      onCancel={() => {}}
    />
  ), { width: 80, height: 12, kittyKeyboard: true });

  try {
    await flushRender(rendered);

    rendered.mockInput.pressArrow("up");
    rendered.mockInput.pressArrow("up");
    rendered.mockInput.pressArrow("up");
    await flushRender(rendered);
    const beforeRemove = autocompleteLines(rendered).join("\n");

    rendered.mockInput.pressKey("x", { ctrl: true });
    await flushRender(rendered);
    const afterRemove = autocompleteLines(rendered).join("\n");

    return { beforeRemove, afterRemove, removed: [...removed] };
  } finally {
    rendered.renderer.destroy();
  }
}

async function renderRevsetPromptIgnoresCtrlXForCompletions() {
  const removed: string[] = [];
  const client = {
    loadBookmarks: async () => ["zzbookmark"],
    loadTags: async () => [],
    loadAliases: async () => ({}),
  } as unknown as JjClient;

  const rendered = await testRender(() => (
    <RevsetPrompt
      revsetQuery="zz"
      client={client}
      config={config}
      workspaceRoot="/repo"
      loadHistory={async () => []}
      removeHistory={async (_root, entry) => {
        removed.push(entry);
        return [];
      }}
      onApply={() => {}}
      onCancel={() => {}}
    />
  ), { width: 80, height: 12, kittyKeyboard: true });

  try {
    await flushRender(rendered);

    rendered.mockInput.pressArrow("up");
    await flushRender(rendered);
    const beforeRemove = autocompleteLines(rendered).join("\n");

    rendered.mockInput.pressKey("x", { ctrl: true });
    await flushRender(rendered);
    const afterRemove = autocompleteLines(rendered).join("\n");

    return { beforeRemove, afterRemove, removed: [...removed] };
  } finally {
    rendered.renderer.destroy();
  }
}

const command = await renderCommandPromptHistoryRemoval();
const bookmark = await renderBookmarkPromptIgnoresCtrlX();
const revsetHistory = await renderRevsetPromptHistoryRemoval();
const revsetCompletion = await renderRevsetPromptIgnoresCtrlXForCompletions();
console.log(JSON.stringify({ command, bookmark, revsetHistory, revsetCompletion }));
