import { testRender } from "@opentui/solid";
import type { RGBA, ScrollBoxRenderable } from "@opentui/core";
import {
  FALLBACK_PALETTE_DARK,
  FALLBACK_PALETTE_LIGHT,
  resolveAppConfig,
} from "../../src/config/index.ts";
import { PreviewPane } from "../../src/ui/PreviewPane.tsx";

const originalConsoleLog = console.log;
console.log = (...args: unknown[]) => {
  if (typeof args[0] === "string" && args[0].startsWith("TSWorker:")) {
    return;
  }
  originalConsoleLog(...args);
};

const config = resolveAppConfig({});
const darkConfig = resolveAppConfig({}, { palette: FALLBACK_PALETTE_DARK });
const lightConfig = resolveAppConfig({}, { palette: FALLBACK_PALETTE_LIGHT });

// A two-file git diff, as `jj diff --git` would produce for a revision.
const multiFileDiff = `diff --git a/one.ts b/one.ts
index 1111111..2222222 100644
--- a/one.ts
+++ b/one.ts
@@ -1,2 +1,2 @@
 context
-old
+new
diff --git a/two.md b/two.md
index 3333333..4444444 100644
--- a/two.md
+++ b/two.md
@@ -1 +1 @@
-before
+after
`;

const singleFileDiff = `diff --git a/solo.ts b/solo.ts
index 1111111..2222222 100644
--- a/solo.ts
+++ b/solo.ts
@@ -1 +1 @@
-x
+y
`;

const wideDiff = `diff --git a/wide.ts b/wide.ts
index 1111111..2222222 100644
--- a/wide.ts
+++ b/wide.ts
@@ -1 +1 @@
-const short = 1;
+const reallyLongVariableName = someFunctionCall(withLots, of, arguments, thatExceed, theViewport, widthEasily, forSure);
`;

async function capture(
  header: string | null,
  diff: string,
  options: {
    width?: number;
    height?: number;
    scrollX?: boolean;
    scrollDownBy?: number;
    config?: typeof config;
    previewWordWrap?: boolean;
    waitForExactSpan?: string;
  } = {},
) {
  const width = options.width ?? 60;
  const height = options.height ?? 30;
  let scrollbox: ScrollBoxRenderable | undefined;
  const rendered = await testRender(() => (
    <PreviewPane
      header={header}
      diff={diff}
      loading={false}
      viewportWidth={width - 1}
      config={options.config ?? config}
      previewWordWrap={options.previewWordWrap ?? false}
      registerScrollbox={(el) => {
        scrollbox = el;
      }}
    />
  ), { width, height });

  await rendered.renderOnce();
  // Code highlighting happens asynchronously after the first render pass.
  const highlightPasses = options.waitForExactSpan ? 100 : 5;
  for (let i = 0; i < highlightPasses; i++) {
    await new Promise((resolve) => setTimeout(resolve, options.waitForExactSpan ? 10 : 0));
    await rendered.renderOnce();
    if (options.waitForExactSpan) {
      const frame = rendered.captureSpans();
      const foundSpan = frame.lines.some((line) =>
        line.spans.some((span) => span.text === options.waitForExactSpan)
      );
      if (foundSpan) break;
    }
  }
  const spans = rendered.captureSpans();
  const toLines = (frame: typeof spans) => frame.lines.map((l) => l.spans.map((s) => s.text).join(""));
  const scrollWidth = scrollbox?.scrollWidth ?? null;
  const scrollHeight = scrollbox?.scrollHeight ?? null;
  const viewportWidth = scrollbox?.viewport.width ?? null;
  let afterScrollLeft: number | null = null;
  if (options.scrollX && scrollbox) {
    scrollbox.scrollBy({ x: 15, y: 0 });
    await rendered.renderOnce();
    afterScrollLeft = scrollbox.scrollLeft;
  }
  let linesAfterScrollDown: string[] | null = null;
  let scrollTopAfter: number | null = null;
  if (options.scrollDownBy && scrollbox) {
    scrollbox.scrollBy({ x: 0, y: options.scrollDownBy });
    await rendered.renderOnce();
    scrollTopAfter = scrollbox.scrollTop;
    linesAfterScrollDown = toLines(rendered.captureSpans());
  }
  rendered.renderer.destroy();

  const rgb = (color: RGBA): [number, number, number] => {
    const [r, g, b] = color.toInts();
    return [r, g, b];
  };
  const coloredSpans = spans.lines
    .flatMap((l) => l.spans)
    .filter((s) => s.text.trim().length > 0)
    .map((s) => ({ text: s.text, fg: rgb(s.fg), bg: rgb(s.bg) }));

  return {
    registered: Boolean(scrollbox),
    lines: toLines(spans),
    coloredSpans,
    scrollWidth,
    scrollHeight,
    viewportWidth,
    afterScrollLeft,
    linesAfterScrollDown,
    scrollTopAfter,
  };
}

// Find the background color of the rendered span containing `needle`.
function bgOf(scenario: { coloredSpans: { text: string; bg: [number, number, number] }[] }, needle: string): [number, number, number] | null {
  return scenario.coloredSpans.find((s) => s.text.includes(needle))?.bg ?? null;
}

function fgOf(scenario: { coloredSpans: { text: string; fg: [number, number, number] }[] }, needle: string): [number, number, number] | null {
  return scenario.coloredSpans.find((s) => s.text.includes(needle))?.fg ?? null;
}

// Distinctive single-token added/removed lines so their rendered background
// color can be located unambiguously in the captured spans.
const themedDiff = `diff --git a/theme.ts b/theme.ts
index 1111111..2222222 100644
--- a/theme.ts
+++ b/theme.ts
@@ -1,2 +1,2 @@
 keepcontext
-removedtoken
+addedtoken
`;

const syntaxDiff = `diff --git a/syntax.ts b/syntax.ts
index 1111111..2222222 100644
--- a/syntax.ts
+++ b/syntax.ts
@@ -1,2 +1,2 @@
 const keep = "contextsyntax"; // contextcomment
-const before = "removedsyntax"; // removedcomment
+const after = "addedsyntax"; // addedcomment
`;

// A diff tall enough to overflow a short viewport, so the header (top of the
// scroll content) can be scrolled out of view.
const tallDiffBody = Array.from({ length: 40 }, (_, i) => `+line ${i}`).join("\n");
const tallDiff = `diff --git a/tall.ts b/tall.ts
index 1111111..2222222 100644
--- a/tall.ts
+++ b/tall.ts
@@ -0,0 +1,40 @@
${tallDiffBody}
`;

const withHeader = await capture(
  "Add a preview pane that word-wraps its full description across the pane",
  multiFileDiff,
);
// Header carries a unique token so we can tell whether it scrolled off-screen.
const scrollingHeader = await capture("ZZHEADERZZ revision summary", tallDiff, {
  height: 8,
  scrollDownBy: 30,
});
const singleFile = await capture(null, singleFileDiff);
const headerSingle = await capture("A single-file revision preview", singleFileDiff);
const wide = await capture(null, wideDiff, { width: 40, scrollX: true });
const wideWrapped = await capture(null, wideDiff, { width: 40, scrollX: true, previewWordWrap: true });

const darkThemed = await capture(null, themedDiff, { config: darkConfig });
const lightThemed = await capture(null, themedDiff, { config: lightConfig });
const darkSyntax = await capture(null, syntaxDiff, { config: darkConfig, waitForExactSpan: "const" });
const lightSyntax = await capture(null, syntaxDiff, { config: lightConfig, waitForExactSpan: "const" });

const themeColors = {
  darkAdded: bgOf(darkThemed, "addedtoken"),
  darkRemoved: bgOf(darkThemed, "removedtoken"),
  lightAdded: bgOf(lightThemed, "addedtoken"),
  lightRemoved: bgOf(lightThemed, "removedtoken"),
  darkSyntaxKeyword: fgOf(darkSyntax, "const"),
  lightSyntaxKeyword: fgOf(lightSyntax, "const"),
  darkSyntaxString: fgOf(darkSyntax, "addedsyntax"),
  lightSyntaxString: fgOf(lightSyntax, "addedsyntax"),
  darkSyntaxComment: fgOf(darkSyntax, "addedcomment"),
  lightSyntaxComment: fgOf(lightSyntax, "addedcomment"),
  darkSyntaxAddedBg: bgOf(darkSyntax, "addedsyntax"),
  lightSyntaxAddedBg: bgOf(lightSyntax, "addedsyntax"),
  configDarkAdded: darkConfig.colorScheme.semanticColors.diffAddedFill,
  configLightAdded: lightConfig.colorScheme.semanticColors.diffAddedFill,
  configLightRemoved: lightConfig.colorScheme.semanticColors.diffRemovedFill,
};

console.log(JSON.stringify({ withHeader, singleFile, headerSingle, scrollingHeader, wide, wideWrapped, themeColors }));
