import { testRender } from "@opentui/solid";
import { resolveAppConfig } from "../../src/config/index.ts";
import {
  buildAlignedShortcutGrids,
  buildShortcutEntries,
  type ShortcutPanelBinding,
} from "../../src/ui/shortcutPanel.ts";
import { StatusArea } from "../../src/ui/statusArea.tsx";

const config = resolveAppConfig({});

function binding(key: string, id: string, title: string): ShortcutPanelBinding {
  return { key, command: { id, title } };
}

const userBindings = [binding("Y", "user:revision-log:Y", "Deploy Service")];
const directBindings = [binding("s", "squash", "Squash Revision")];
const inheritedBindings = [binding("q", "quit", "Quit Jif")];

const sections = buildAlignedShortcutGrids(
  [userBindings, directBindings, inheritedBindings].map((bindings) =>
    buildShortcutEntries(bindings)
  ),
  76,
);

const rendered = await testRender(() => (
  <StatusArea
    shortcutSummary=""
    shortcutSummarySegments={[]}
    shortcutLayout={{ sections }}
    expanded
    currentModeLabel="Revisions"
    panelBodyHeight={7}
    config={config}
  />
), { width: 80, height: 13 });

await rendered.renderOnce();
const frame = rendered.captureCharFrame();
rendered.renderer.destroy();

console.log(JSON.stringify({ frame }));
