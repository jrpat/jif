import { testRender } from "@opentui/solid";
import { resolveAppConfig } from "../../src/config/index.ts";
import { StatusArea } from "../../src/ui/statusArea.tsx";

const config = resolveAppConfig({});

const rendered = await testRender(() => (
  <StatusArea
    shortcutSummary=""
    shortcutSummarySegments={[
      { keyLabel: "esc", label: "log" },
      { keyLabel: ":", label: "command" },
    ]}
    shortcutLayout={{
      kind: "single",
      grid: {
        rows: [],
        columnCount: 1,
        columnWidth: 1,
        keyWidth: 1,
        gap: 2,
      },
    }}
    expanded={false}
    currentModeLabel="Revisions"
    panelBodyHeight={1}
    stateChipLabel="file"
    config={config}
  />
), { width: 56, height: 4 });

await rendered.renderOnce();
const frame = rendered.captureCharFrame();
rendered.renderer.destroy();

console.log(JSON.stringify({ frame }));
