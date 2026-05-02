import { testRender } from "@opentui/solid";
import type { ScrollBoxRenderable } from "@opentui/core";
import { resolveAppConfig } from "../../src/config/index.ts";
import { DiffViewer } from "../../src/ui/DiffViewer.tsx";

const config = resolveAppConfig({});
const longLine = `long line ${"0123456789".repeat(12)}`;
let scrollbox: ScrollBoxRenderable | undefined;

const rendered = await testRender(() => {
  return (
    <DiffViewer
      state={{ content: `line 1\nline 2\nline 3\n${longLine}` }}
      config={config}
      registerScrollbox={(el) => {
        scrollbox = el;
      }}
    />
  );
}, { width: 80, height: 10 });

await rendered.renderOnce();
const spans = rendered.captureSpans();
const initialScrollLeft = scrollbox?.scrollLeft ?? null;
const horizontalScrollWidth = scrollbox?.scrollWidth ?? null;
const viewportWidth = scrollbox?.viewport.width ?? null;
scrollbox?.scrollBy({ x: 10, y: 0 });
await rendered.renderOnce();
const afterHorizontalScrollLeft = scrollbox?.scrollLeft ?? null;
rendered.renderer.destroy();

console.log(JSON.stringify({
  lineCount: spans.lines.length,
  lines: spans.lines.map(l => l.spans.map(s => s.text).join("")),
  initialScrollLeft,
  afterHorizontalScrollLeft,
  horizontalScrollWidth,
  viewportWidth,
}));
