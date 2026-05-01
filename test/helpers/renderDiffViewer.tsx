import { testRender } from "@opentui/solid";
import { resolveAppConfig } from "../../src/config/index.ts";
import { DiffViewer } from "../../src/ui/DiffViewer.tsx";

const config = resolveAppConfig({});

const rendered = await testRender(() => {
  return (
    <DiffViewer
      state={{ content: "line 1\nline 2\nline 3" }}
      config={config}
      registerScrollbox={() => {}}
    />
  );
}, { width: 80, height: 10 });

await rendered.renderOnce();
const spans = rendered.captureSpans();
rendered.renderer.destroy();

console.log(JSON.stringify({
  lineCount: spans.lines.length,
  lines: spans.lines.map(l => l.spans.map(s => s.text).join("")),
}));
