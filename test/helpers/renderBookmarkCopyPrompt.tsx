import { testRender } from "@opentui/solid";
import { createSignal } from "solid-js";
import type { InputRenderable } from "@opentui/core";
import { resolveAppConfig } from "../../src/config/index.ts";
import type { AppStore } from "../../src/state/appStore.ts";
import type { BookmarkSuggestion } from "../../src/domain/types.ts";
import { CommandPrompt } from "../../src/ui/prompts.tsx";

const config = resolveAppConfig({});

const PREFILL = "printf %s  | pbcopy";
const CURSOR_OFFSET = "printf %s ".length;
const SUGGESTIONS: readonly BookmarkSuggestion[] = [
  { name: "main", targetChangeId: "aaaaaaaa", bucket: "current", distance: 0 },
  { name: "release", targetChangeId: "aaaaaaaa", bucket: "current", distance: 0 },
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

async function run() {
  const rendered = await testRender(() => {
    const [text, setText] = createSignal(PREFILL);
    const store = {
      actions: {
        setCommandBarText: setText,
      },
    } as unknown as AppStore;

    return (
      <CommandPrompt
        store={store}
        config={config}
        // The shell bar: no structured completion, so the bookmark list is the
        // only suggestion source.
        composeEnabled={false}
        workspaceRoot="/repo"
        loadHistory={async () => ["ls -la"]}
        commandText={text()}
        prefix="❯ "
        placeholder="shell command"
        onSubmit={() => {}}
        bookmarkContext={{ initialCursorOffset: CURSOR_OFFSET, suggestions: SUGGESTIONS }}
      />
    );
  }, { width: 80, height: 12 });

  try {
    await flushRender(rendered);
    const input = findInput(rendered);
    const initialFrame = rendered.captureCharFrame();
    const initial = { plainText: input.plainText, cursorOffset: input.cursorOffset };
    const listsBothBookmarks = initialFrame.includes("main") && initialFrame.includes("release");
    // History must stay out of the way while the bookmark list is showing.
    const listsHistory = initialFrame.includes("ls -la");

    rendered.mockInput.pressKey("r");
    rendered.mockInput.pressKey("e");
    await flushRender(rendered);
    const typedFrame = rendered.captureCharFrame();
    const filtered = {
      showsRelease: typedFrame.includes("release"),
      showsMain: /\bmain\b/.test(typedFrame),
    };

    rendered.mockInput.pressArrow("up");
    await flushRender(rendered);
    const accepted = { plainText: input.plainText, cursorOffset: input.cursorOffset };

    console.log(JSON.stringify({ initial, listsBothBookmarks, listsHistory, filtered, accepted }));
  } finally {
    rendered.renderer.destroy();
  }
}

await run();
