import { testRender } from "@opentui/solid";
import { resolveAppConfig } from "../../src/config/index.ts";
import type { JjClient } from "../../src/jj/client.ts";
import { RevsetPrompt } from "../../src/ui/prompts.tsx";

const config = resolveAppConfig({});

// Box-drawing characters used by the prompt border (single and double styles).
const BORDER_CHARS = /[│║┌┐└┘╔╗╚╝─═]/u;

async function flushRender(rendered: Awaited<ReturnType<typeof testRender>>) {
  await rendered.renderOnce();
  await Promise.resolve();
  await rendered.renderOnce();
}

// The input row is the only line drawn with a vertical border character.
function capturePromptLine(rendered: Awaited<ReturnType<typeof testRender>>): string {
  const lines = rendered.captureCharFrame().split("\n");
  return lines.find((line) => line.includes("│") || line.includes("║")) ?? "";
}

// Suggestion rows sit above the input box and carry no border characters.
function suggestionLines(rendered: Awaited<ReturnType<typeof testRender>>): string {
  return rendered.captureCharFrame().split("\n").filter((line) => !BORDER_CHARS.test(line)).join("\n");
}

// Complete-at-point (revset-token completion) is signalled by a double border
// (║ verticals); the history fallback uses the default single border.
function hasDoubleBorder(rendered: Awaited<ReturnType<typeof testRender>>): boolean {
  return rendered.captureCharFrame().includes("║");
}

const client = {
  loadBookmarks: async () => ["mainline"],
  loadTags: async () => [],
  loadAliases: async () => ({}),
} as unknown as JjClient;

function renderPrompt(revsetQuery: string, history: readonly string[]) {
  return testRender(() => (
    <RevsetPrompt
      revsetQuery={revsetQuery}
      client={client}
      config={config}
      workspaceRoot="/repo"
      loadHistory={async () => [...history]}
      onApply={() => {}}
      onCancel={() => {}}
    />
  ), { width: 80, height: 14, kittyKeyboard: true });
}

async function renderToggles() {
  // The active revset ("main") is also present in history; it must be hidden
  // from the list. "alpha()" is the most recent entry, so it is the bottom item.
  const rendered = await renderPrompt("main", ["alpha()", "beta()", "main"]);

  try {
    await flushRender(rendered);
    const beforeToggleList = suggestionLines(rendered);
    const beforeTogglePrompt = capturePromptLine(rendered);
    const beforeToggleDoubleBorder = hasDoubleBorder(rendered);

    // ctrl+l: switch from revset completions to the history list.
    rendered.mockInput.pressKey("l", { ctrl: true });
    await flushRender(rendered);
    const afterToggleList = suggestionLines(rendered);
    const afterTogglePrompt = capturePromptLine(rendered);
    const afterToggleDoubleBorder = hasDoubleBorder(rendered);

    // Move up once: the bottom entry was pre-focused, so this advances to the
    // next history entry.
    rendered.mockInput.pressArrow("up");
    await flushRender(rendered);
    const secondPrompt = capturePromptLine(rendered);

    // ctrl+l again toggles back to completions and restores the typed text.
    rendered.mockInput.pressKey("l", { ctrl: true });
    await flushRender(rendered);
    const afterUntoggleList = suggestionLines(rendered);
    const afterUntogglePrompt = capturePromptLine(rendered);
    const afterUntoggleDoubleBorder = hasDoubleBorder(rendered);

    return {
      beforeToggleList,
      beforeTogglePrompt,
      beforeToggleDoubleBorder,
      afterToggleList,
      afterTogglePrompt,
      afterToggleDoubleBorder,
      secondPrompt,
      afterUntoggleList,
      afterUntogglePrompt,
      afterUntoggleDoubleBorder,
    };
  } finally {
    rendered.renderer.destroy();
  }
}

async function renderNoopWhenEmpty() {
  // No history entries to show, so ctrl+l must do nothing (stay on completions,
  // double border).
  const rendered = await renderPrompt("main", []);

  try {
    await flushRender(rendered);
    const before = { list: suggestionLines(rendered), doubleBorder: hasDoubleBorder(rendered) };

    rendered.mockInput.pressKey("l", { ctrl: true });
    await flushRender(rendered);
    const after = { list: suggestionLines(rendered), doubleBorder: hasDoubleBorder(rendered) };

    return { before, after };
  } finally {
    rendered.renderer.destroy();
  }
}

const toggles = await renderToggles();
const noopWhenEmpty = await renderNoopWhenEmpty();

console.log(JSON.stringify({ toggles, noopWhenEmpty }));
