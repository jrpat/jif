import { testRender } from "@opentui/solid";
import { AutocompleteList, type AutocompleteListItem } from "../../src/ui/AutocompleteList.tsx";
import { resolveAppConfig } from "../../src/config/index.ts";

const config = resolveAppConfig({});

async function attrsFor(item: AutocompleteListItem, needle: string): Promise<number | null> {
  const rendered = await testRender(
    () => (
      <AutocompleteList
        items={[item]}
        selectedIndex={null}
        flow="top-to-bottom"
        config={config}
        maxVisibleItems={5}
      />
    ),
    { width: 50, height: 6 },
  );
  await rendered.renderOnce();
  const spans = rendered.captureSpans();
  rendered.renderer.destroy();

  for (const line of spans.lines) {
    for (const span of line.spans) {
      if (span.text.includes(needle)) {
        return span.attributes;
      }
    }
  }
  return null;
}

// A flag completion row: bold long flag, dim short tag, dim description.
const flagItem: AutocompleteListItem = {
  id: "flag:--revision",
  tag: "-r",
  text: "--revision",
  bold: true,
  detail: "Which revisions to show",
};
const plainItem: AutocompleteListItem = { id: "plain", text: "plain-row" };

// Flags with descriptions far too long for the width. Each must stay on its own
// single line: if a row wrapped, it would consume two lines and push later rows
// out of the (item-counted) viewport, which is what made global flags look
// "missing". The long flag name itself must also never be clipped.
const longRows: AutocompleteListItem[] = [
  { id: "flag:--ignore-space-change", tag: "-i", text: "--ignore-space-change", bold: true, detail: "Ignore changes in amount of whitespace when comparing lines" },
  { id: "flag:--no-graph", tag: "-G", text: "--no-graph", bold: true, detail: "Don't show the graph, show a flat list of revisions instead" },
  { id: "flag:--reversed", text: "--reversed", bold: true, detail: "Show revisions in the opposite order (older revisions first)" },
  { id: "flag:--revision", tag: "-r", text: "--revision", bold: true, detail: "Which revisions to show in the log, defaults to the configured set" },
];

async function noWrapScenario() {
  const rendered = await testRender(
    () => (
      <AutocompleteList
        items={longRows}
        selectedIndex={null}
        flow="top-to-bottom"
        config={config}
        maxVisibleItems={10}
      />
    ),
    { width: 40, height: 10 },
  );
  for (let i = 0; i < 4; i++) {
    await rendered.renderOnce();
    await Promise.resolve();
  }
  const spans = rendered.captureSpans();
  rendered.renderer.destroy();

  const spanTexts = spans.lines.flatMap((line) => line.spans.map((s) => s.text));
  const allFlagsVisible = longRows.every((row) => spanTexts.some((t) => t.includes(row.text)));
  const flagSpanIntact = spanTexts.some((t) => t.includes("--ignore-space-change"));
  return { allFlagsVisible, flagSpanIntact };
}

console.log(
  JSON.stringify({
    revisionAttrs: await attrsFor(flagItem, "--revision"),
    shortTagAttrs: await attrsFor(flagItem, "-r"),
    plainAttrs: await attrsFor(plainItem, "plain-row"),
    ...(await noWrapScenario()),
  }),
);
