import { testRender } from "@opentui/solid";
import { createSignal } from "solid-js";
import type { TextareaRenderable } from "@opentui/core";
import { resolveAppConfig } from "../../src/config/index.ts";
import type { AppStore } from "../../src/state/appStore.ts";
import { CommandPrompt } from "../../src/ui/prompts.tsx";

const config = resolveAppConfig({});

type Rendered = Awaited<ReturnType<typeof testRender>>;

async function flushRender(rendered: Rendered) {
  await rendered.renderOnce();
  await Promise.resolve();
  await rendered.renderOnce();
}

function findTextarea(rendered: Rendered): TextareaRenderable {
  const stack: any[] = [(rendered.renderer as any).root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (node && typeof node.virtualLineCount === "number" && typeof node.plainText === "string") {
      return node as TextareaRenderable;
    }
    const children = node?.getChildren?.() ?? node?.children ?? [];
    for (const child of children) stack.push(child);
  }
  throw new Error("textarea not found");
}

async function observeWrapping() {
  // At terminal width 40 with the "jj " prefix the text area is 32 columns, so
  // this line wraps to three visual rows.
  const longCommand =
    "one two three four five six seven eight nine ten eleven twelve thirteen";

  let submitted: string | null = null;
  let reportedHeight = 0;
  const wrapRender = await testRender(() => {
    const [text, setText] = createSignal("");
    const store = {
      actions: { setCommandBarText: setText },
      state: {},
    } as unknown as AppStore;
    return (
      <CommandPrompt
        store={store}
        config={config}
        workspaceRoot="/repo"
        loadHistory={async () => []}
        commandText={text()}
        prefix="jj "
        placeholder="subcommand"
        onSubmit={(v) => {
          submitted = v;
        }}
        onHeightChange={(h) => {
          reportedHeight = h;
        }}
      />
    );
  }, { width: 40, height: 16 });

  try {
    await flushRender(wrapRender);
    const ta = findTextarea(wrapRender);
    const heightWhenEmpty = reportedHeight;
    const taHeightWhenEmpty = ta.height;

    wrapRender.mockInput.typeText(longCommand);
    await flushRender(wrapRender);

    const plainText = ta.plainText;
    const virtualLineCount = ta.virtualLineCount;
    const taHeightWhenWrapped = ta.height;
    const heightWhenWrapped = reportedHeight;

    // Enter submits the whole wrapped command (no literal newline is inserted).
    wrapRender.mockInput.pressEnter();
    await flushRender(wrapRender);
    const plainTextAfterEnter = ta.plainText;

    // A hyphen-heavy command, where OpenTUI breaks at hyphens differently from our
    // first command: the rendered text area height still matches OpenTUI's actual
    // wrap exactly.
    for (let i = 0; i < longCommand.length; i++) wrapRender.mockInput.pressBackspace();
    await flushRender(wrapRender);
    wrapRender.mockInput.typeText(
      "rebase --source abcdef --destination ghijkl --skip-emptied",
    );
    await flushRender(wrapRender);
    const hyphenTaHeight = ta.height;
    const hyphenVirtualLineCount = ta.virtualLineCount;

    // Once the prompt reaches half the terminal height, it scrolls instead of
    // taking more rows from the log.
    wrapRender.mockInput.typeText("x".repeat(1000));
    await flushRender(wrapRender);

    return {
      plainText,
      virtualLineCount,
      taHeightWhenEmpty,
      taHeightWhenWrapped,
      heightWhenEmpty,
      heightWhenWrapped,
      submitted,
      plainTextAfterEnter,
      hyphenTaHeight,
      hyphenVirtualLineCount,
      cappedTaHeight: ta.height,
      cappedHeight: reportedHeight,
    };
  } finally {
    wrapRender.renderer.destroy();
  }
}

async function observeHistoryDraft() {
  const guardRender = await testRender(() => {
    const [text, setText] = createSignal("");
    const store = {
      actions: { setCommandBarText: setText },
      state: {},
    } as unknown as AppStore;
    return (
      <CommandPrompt
        store={store}
        config={config}
        workspaceRoot="/repo"
        loadHistory={async () => ["status --long"]}
        commandText={text()}
        prefix="jj "
        placeholder="subcommand"
        onSubmit={() => {}}
      />
    );
  }, { width: 40, height: 16 });

  try {
    await flushRender(guardRender);
    const ta = findTextarea(guardRender);

    guardRender.mockInput.typeText("status");
    await flushRender(guardRender);
    const draft = ta.plainText;

    guardRender.mockInput.pressArrow("up"); // preview the history entry
    await flushRender(guardRender);
    const previewed = ta.plainText;

    guardRender.mockInput.pressArrow("down"); // back to the draft
    await flushRender(guardRender);
    const afterDown = ta.plainText;

    return { draft, previewed, afterDown };
  } finally {
    guardRender.renderer.destroy();
  }
}

async function run() {
  const wrap = await observeWrapping();
  const guard = await observeHistoryDraft();
  console.log(JSON.stringify({ wrap, guard }));
}

await run();
