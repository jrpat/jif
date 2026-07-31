import type { InputRenderable } from "@opentui/core";
import { testRender } from "@opentui/solid";
import { createSignal } from "solid-js";
import { resolveAppConfig } from "../../src/config/index.ts";
import {
  buildShortcutEntries,
  buildShortcutGrid,
  type ShortcutPanelBinding,
} from "../../src/ui/shortcutPanel.ts";
import { StatusArea } from "../../src/ui/statusArea.tsx";

const config = resolveAppConfig({});
const bindings: readonly ShortcutPanelBinding[] = [
  {
    key: "ctrl-r",
    command: {
      id: "refresh-repository",
      title: "Refresh Repository",
      description: "Refresh the revision log",
    },
  },
  {
    key: "s",
    command: {
      id: "squash",
      title: "Squash Revision",
      description: "Move changes into another revision",
    },
  },
];

async function flushRender(rendered: Awaited<ReturnType<typeof testRender>>) {
  await rendered.renderOnce();
  await Promise.resolve();
  await rendered.renderOnce();
}

let getQuery!: () => string;
let getEditing!: () => boolean;

const rendered = await testRender(() => {
  const [query, setQuery] = createSignal("");
  const [editing, setEditing] = createSignal(true);
  getQuery = query;
  getEditing = editing;

  return (
    <StatusArea
      shortcutSummary=""
      shortcutSummarySegments={[]}
      shortcutLayout={{
        sections: [buildShortcutGrid(buildShortcutEntries(bindings, query()), 76)],
      }}
      expanded
      currentModeLabel="Revisions"
      panelBodyHeight={3}
      config={config}
      shortcutFilterQuery={query()}
      shortcutFilterEditing={editing()}
      onShortcutFilterInput={setQuery}
      onShortcutFilterApply={() => setEditing(false)}
    />
  );
}, { width: 80, height: 9 });

try {
  await flushRender(rendered);
  const initialFrame = rendered.captureCharFrame();

  rendered.mockInput.pressKey("?");
  await flushRender(rendered);
  const questionQuery = getQuery();
  rendered.mockInput.pressBackspace();
  await flushRender(rendered);

  rendered.mockInput.pressKey("repo");
  await flushRender(rendered);
  const filteredFrame = rendered.captureCharFrame();
  const matchingEntry = rendered.renderer.root.findDescendantById(
    "shortcut-entry:refresh-repository:ctrl-r",
  );
  const nonmatchingEntry = rendered.renderer.root.findDescendantById(
    "shortcut-entry:squash:s",
  );

  rendered.mockInput.pressEnter();
  await flushRender(rendered);
  const appliedFrame = rendered.captureCharFrame();
  const input = rendered.renderer.root.findDescendantById(
    "shortcut-filter-input",
  ) as InputRenderable | undefined;

  console.log(JSON.stringify({
    initialFrame,
    filteredFrame,
    appliedFrame,
    matchingPresent: matchingEntry !== null && matchingEntry !== undefined,
    nonmatchingPresent: nonmatchingEntry !== null && nonmatchingEntry !== undefined,
    questionQuery,
    query: getQuery(),
    editing: getEditing(),
    inputFocused: input?.focused ?? null,
  }));
} finally {
  rendered.renderer.destroy();
}
