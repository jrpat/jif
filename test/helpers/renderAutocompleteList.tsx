import { testRender } from "@opentui/solid";
import { AutocompleteList } from "../../src/ui/AutocompleteList.tsx";
import { resolveAppConfig } from "../../src/config/index.ts";

const config = resolveAppConfig({});

// 15 items — more than the 5 visible at a time.
// With bottom-to-top flow and correct initial scroll, the last rendered
// line should show "all" (item 0), since it's closest to the input below.
const items = [
  { id: "all", text: "all" },
  { id: "ancestors", text: "ancestors" },
  { id: "author", text: "author" },
  { id: "bookmarks", text: "bookmarks" },
  { id: "branches", text: "branches" },
  { id: "children", text: "children" },
  { id: "conflicts", text: "conflicts" },
  { id: "description", text: "description" },
  { id: "descendants", text: "descendants" },
  { id: "diff_contains", text: "diff_contains" },
  { id: "empty", text: "empty" },
  { id: "file", text: "file" },
  { id: "fork_point", text: "fork_point" },
  { id: "git_head", text: "git_head" },
  { id: "heads", text: "heads" },
];

const rendered = await testRender(
  () => (
    <AutocompleteList
      items={items}
      selectedIndex={null}
      flow="bottom-to-top"
      config={config}
      maxVisibleItems={5}
    />
  ),
  { width: 40, height: 5 },
);

await rendered.renderOnce();
const frame = rendered.captureCharFrame();
rendered.renderer.destroy();

console.log(JSON.stringify({ frame }));
