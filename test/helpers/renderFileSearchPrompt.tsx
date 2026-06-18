import { testRender } from "@opentui/solid";
import { resolveAppConfig } from "../../src/config/index.ts";
import { FileSearchPrompt } from "../../src/ui/prompts.tsx";

const config = resolveAppConfig({});
const files = [
  "README.md",
  "docs/guide.md",
  "src/app.ts",
  "src/revset/completions.ts",
  "test/revisionRender.test.ts",
] as const;

type FileSearchClient = Readonly<{
  loadKnownFiles(): Promise<readonly string[]>;
}>;

function captureFrame(rendered: Awaited<ReturnType<typeof testRender>>): string {
  return rendered.captureCharFrame();
}

async function flushRender(rendered: Awaited<ReturnType<typeof testRender>>) {
  await rendered.renderOnce();
  await Promise.resolve();
  await rendered.renderOnce();
}

async function renderApplyFlow() {
  const applied: string[] = [];
  const edited: string[] = [];
  const client = {
    loadKnownFiles: async () => [...files],
  } satisfies FileSearchClient;

  const rendered = await testRender(() => (
    <FileSearchPrompt
      client={client}
      config={config}
      onApply={(query) => {
        applied.push(query);
      }}
      onEditRevset={(query) => {
        edited.push(query);
      }}
      onCancel={() => {}}
    />
  ), { width: 80, height: 12 });

  try {
    await flushRender(rendered);
    const initialFrame = captureFrame(rendered);

    await rendered.mockInput.typeText("rev");
    await flushRender(rendered);
    const filteredFrame = captureFrame(rendered);

    rendered.mockInput.pressEnter();
    await flushRender(rendered);

    return {
      initialFrame,
      filteredFrame,
      applied,
      edited,
    };
  } finally {
    rendered.renderer.destroy();
  }
}

async function renderEditFlow() {
  const applied: string[] = [];
  const edited: string[] = [];
  const client = {
    loadKnownFiles: async () => [...files],
  } satisfies FileSearchClient;

  const rendered = await testRender(() => (
    <FileSearchPrompt
      client={client}
      config={config}
      onApply={(query) => {
        applied.push(query);
      }}
      onEditRevset={(query) => {
        edited.push(query);
      }}
      onCancel={() => {}}
    />
  ), { width: 80, height: 12 });

  try {
    await flushRender(rendered);

    await rendered.mockInput.typeText("guide");
    await flushRender(rendered);

    rendered.mockInput.pressKey("l", { ctrl: true });
    await flushRender(rendered);

    return {
      applied,
      edited,
    };
  } finally {
    rendered.renderer.destroy();
  }
}

console.log(JSON.stringify({
  apply: await renderApplyFlow(),
  edit: await renderEditFlow(),
}));
