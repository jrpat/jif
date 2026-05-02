import { testRender } from "@opentui/solid";
import { createSignal } from "solid-js";
import type { InputRenderable } from "@opentui/core";
import { resolveAppConfig } from "../../src/config/index.ts";
import type { AppStore } from "../../src/state/appStore.ts";
import { CommandPrompt } from "../../src/ui/prompts.tsx";

const config = resolveAppConfig({});

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
  const history = ["zzalpha"] as const;
  const rendered = await testRender(() => {
    const [text, setText] = createSignal("");
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
    const input = findInput(rendered);
    const afterUp = { plainText: input.plainText, cursorOffset: input.cursorOffset };

    rendered.mockInput.pressArrow("left");
    rendered.mockInput.pressArrow("left");
    await flushRender(rendered);
    const afterLeft = { plainText: input.plainText, cursorOffset: input.cursorOffset };

    rendered.mockInput.pressBackspace();
    await flushRender(rendered);
    const afterBackspace = { plainText: input.plainText, cursorOffset: input.cursorOffset };

    rendered.mockInput.pressKey("X");
    await flushRender(rendered);
    const afterType = { plainText: input.plainText, cursorOffset: input.cursorOffset };

    console.log(JSON.stringify({ afterUp, afterLeft, afterBackspace, afterType }));
  } finally {
    rendered.renderer.destroy();
  }
}

await run();
