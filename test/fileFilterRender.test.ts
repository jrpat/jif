import { expect, test } from "bun:test";

type Span = Readonly<{
  text: string;
  fg: [number, number, number, number];
  bg: [number, number, number, number];
}>;

const proc = Bun.spawn({
  cmd: ["bun", "run", "test/helpers/renderFileFilter.tsx"],
  cwd: process.cwd(),
  stdout: "pipe",
  stderr: "pipe",
});
const [stdout, stderr, exitCode] = await Promise.all([
  new Response(proc.stdout).text(),
  new Response(proc.stderr).text(),
  proc.exited,
]);

const rendered = exitCode === 0 && stderr === ""
  ? JSON.parse(stdout) as {
    unfiltered: string;
    opened: string;
    typed: string;
    noMatches: string;
    committed: { frame: string; focusMode: string };
    highlightedSpans: readonly Span[];
  }
  : null;

function lineIndex(frame: string, text: string): number {
  return frame.split("\n").findIndex((line) => line.includes(text));
}

test("the file filter helper renders", () => {
  expect(stderr).toBe("");
  expect(exitCode).toBe(0);
  expect(rendered).not.toBeNull();
});

test("the expanded file list has no filter row until the filter is opened", () => {
  expect(rendered!.unfiltered).toContain("src/ui/render.tsx");
  expect(rendered!.unfiltered).toContain("src/state/store.ts");
  expect(rendered!.unfiltered).toContain("test/render.test.ts");
  expect(rendered!.unfiltered).not.toContain("/ ");
});

test("opening the filter puts a prompt above the first file row", () => {
  expect(rendered!.opened).toContain("/ filter files");
  expect(lineIndex(rendered!.opened, "src/ui/render.tsx"))
    .toBe(lineIndex(rendered!.opened, "/ filter files") + 1);
});

test("typing narrows the list to files whose path contains the query", () => {
  expect(rendered!.typed).toContain("/ render");
  expect(rendered!.typed).toContain("src/ui/render.tsx");
  expect(rendered!.typed).toContain("test/render.test.ts");
  expect(rendered!.typed).not.toContain("src/state/store.ts");
});

test("a filter that matches nothing says so instead of showing an empty list", () => {
  expect(rendered!.noMatches).toContain("No matching files");
});

test("committing the filter with Enter leaves the narrowed list and its prompt on screen", () => {
  expect(rendered!.committed.focusMode).toBe("files");
  expect(rendered!.committed.frame).toContain("/ render");
  expect(rendered!.committed.frame).not.toContain("src/state/store.ts");
});

test("matching path text is drawn as inverse video", () => {
  const spans = rendered!.highlightedSpans;
  const matched = spans.find((span) => span.text === "state");
  const trailing = spans.find((span) => span.text === "/store.ts");

  expect(matched).toBeDefined();
  expect(trailing).toBeDefined();
  expect(matched!.bg).toEqual(trailing!.fg);
  expect(matched!.fg).not.toEqual(trailing!.fg);
  expect(matched!.bg).not.toEqual(trailing!.bg);
});
