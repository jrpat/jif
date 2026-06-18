import { testRender } from "@opentui/solid";
import { createSignal } from "solid-js";
import { resolveAppConfig } from "../../src/config/index.ts";
import type { JjClient } from "../../src/jj/client.ts";
import type { AppStore } from "../../src/state/appStore.ts";
import { CommandPrompt, RevsetPrompt } from "../../src/ui/prompts.tsx";

const config = resolveAppConfig({});

function capturePromptLine(rendered: Awaited<ReturnType<typeof testRender>>): string {
  const lines = rendered.captureCharFrame().split("\n");
  return lines.find((line) => line.includes("│") || line.includes("║")) ?? "";
}

async function flushRender(rendered: Awaited<ReturnType<typeof testRender>>) {
  await rendered.renderOnce();
  await Promise.resolve();
  await rendered.renderOnce();
}

function findVisibleCandidate(line: string, candidates: readonly string[]): string | null {
  return candidates.find((candidate) => line.includes(candidate)) ?? null;
}

async function renderCommandPromptNavigation() {
  const draft = "zz";
  const history = ["zzalpha", "zzbeta"] as const;
  const rendered = await testRender(() => {
    const [text, setText] = createSignal(draft);
    const store = {
      actions: {
        setCommandBarText: setText,
      },
    } as unknown as AppStore;

    return (
      <CommandPrompt
        store={store}
        config={config}
        workspaceRoot="/repo"
        loadHistory={async () => [...history]}
        commandText={text()}
        prefix="jj "
        placeholder="subcommand"
        onSubmit={() => {}}
      />
    );
  }, { width: 80, height: 12 });

  try {
    await flushRender(rendered);
    const initialLine = capturePromptLine(rendered);

    rendered.mockInput.pressArrow("up");
    await flushRender(rendered);
    const firstPreview = findVisibleCandidate(capturePromptLine(rendered), history);

    rendered.mockInput.pressArrow("up");
    await flushRender(rendered);
    const secondPreview = findVisibleCandidate(capturePromptLine(rendered), history);

    rendered.mockInput.pressArrow("down");
    await flushRender(rendered);

    rendered.mockInput.pressArrow("down");
    await flushRender(rendered);
    const restoredLine = capturePromptLine(rendered);

    return {
      initialLine,
      firstPreview,
      secondPreview,
      restoredLine,
    };
  } finally {
    rendered.renderer.destroy();
  }
}

async function renderCommandPromptEditAfterPreview() {
  const draft = "zz";
  const history = ["zzalpha", "zzbeta"] as const;
  const rendered = await testRender(() => {
    const [text, setText] = createSignal(draft);
    const store = {
      actions: {
        setCommandBarText: setText,
      },
    } as unknown as AppStore;

    return (
      <CommandPrompt
        store={store}
        config={config}
        workspaceRoot="/repo"
        loadHistory={async () => [...history]}
        commandText={text()}
        prefix="jj "
        placeholder="subcommand"
        onSubmit={() => {}}
      />
    );
  }, { width: 80, height: 12 });

  try {
    await flushRender(rendered);

    rendered.mockInput.pressArrow("up");
    await flushRender(rendered);
    const firstPreview = findVisibleCandidate(capturePromptLine(rendered), history);
    const editedText = firstPreview?.slice(0, -1) ?? null;

    rendered.mockInput.pressBackspace();
    await flushRender(rendered);

    return {
      editedLine: capturePromptLine(rendered),
      editedText,
    };
  } finally {
    rendered.renderer.destroy();
  }
}

async function renderRevsetPromptNavigation() {
  const draft = "zz";
  const candidates = ["zzalpha", "zzbeta"] as const;
  const client = {
    loadBookmarks: async () => [candidates[0]],
    loadTags: async () => [candidates[1]],
    loadAliases: async () => ({}),
  } as JjClient;

  const rendered = await testRender(() => (
    <RevsetPrompt
      revsetQuery={draft}
      client={client}
      config={config}
      workspaceRoot="/repo"
      loadHistory={async () => []}
      onApply={() => {}}
      onCancel={() => {}}
    />
  ), { width: 80, height: 12 });

  try {
    await flushRender(rendered);
    const initialLine = capturePromptLine(rendered);

    rendered.mockInput.pressArrow("up");
    await flushRender(rendered);
    const firstPreview = findVisibleCandidate(capturePromptLine(rendered), candidates);

    rendered.mockInput.pressArrow("up");
    await flushRender(rendered);
    const secondPreview = findVisibleCandidate(capturePromptLine(rendered), candidates);

    rendered.mockInput.pressArrow("down");
    await flushRender(rendered);

    rendered.mockInput.pressArrow("down");
    await flushRender(rendered);
    const restoredLine = capturePromptLine(rendered);

    return {
      initialLine,
      firstPreview,
      secondPreview,
      restoredLine,
    };
  } finally {
    rendered.renderer.destroy();
  }
}

async function renderShellPrompt() {
  const rendered = await testRender(() => {
    const [text, setText] = createSignal("pwd");
    const store = {
      actions: {
        setCommandBarText: setText,
      },
    } as unknown as AppStore;

    return (
      <CommandPrompt
        store={store}
        config={config}
        workspaceRoot="/repo"
        loadHistory={async () => ["pwd | cat"]}
        commandText={text()}
        prefix="❯ "
        placeholder="shell command"
        onSubmit={() => {}}
      />
    );
  }, { width: 80, height: 12 });

  try {
    await flushRender(rendered);
    return {
      initialLine: capturePromptLine(rendered),
    };
  } finally {
    rendered.renderer.destroy();
  }
}

const command = {
  ...await renderCommandPromptNavigation(),
  ...await renderCommandPromptEditAfterPreview(),
};
const shell = await renderShellPrompt();
const revset = await renderRevsetPromptNavigation();

console.log(JSON.stringify({ command, shell, revset }));
