import { expect, test } from "bun:test";

// Modules that only render for interactions that cannot occur on the first
// painted frame (prompts, overlays, alternate focus modes). render.tsx must
// load them with lazy(() => import(...)) so their evaluation stays off the
// startup critical path.
const DEFERRED_UI_MODULES = [
  "./DiffViewer.tsx",
  "./PreviewPane.tsx",
  "./InlineConfirmation.tsx",
  "./NotificationsOverlay.tsx",
  "./OperationLogEntryItem.tsx",
  "./prompts.tsx",
  "./searchOverlay.tsx",
] as const;

test("render.tsx defers non-first-paint UI modules behind dynamic imports", async () => {
  const source = await Bun.file("src/ui/render.tsx").text();
  const transpiler = new Bun.Transpiler({ loader: "tsx" });
  const imports = transpiler.scanImports(source);

  for (const specifier of DEFERRED_UI_MODULES) {
    const statically = imports.some(
      (entry) => entry.path === specifier && entry.kind === "import-statement",
    );
    const dynamically = imports.some(
      (entry) => entry.path === specifier && entry.kind === "dynamic-import",
    );

    expect(statically, `${specifier} must not be statically imported by render.tsx`).toBeFalse();
    expect(dynamically, `${specifier} must be loaded via dynamic import in render.tsx`).toBeTrue();
  }
});

test("lazy components render under the OpenTUI solid renderer", async () => {
  const proc = Bun.spawn({
    cmd: ["bun", "run", "test/helpers/renderLazyInlineConfirmation.tsx"],
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  expect(exitCode).toBe(0);
  expect(stderr).toBe("");

  const result = JSON.parse(stdout) as { framePending: string; frame: string };
  expect(result.framePending.trim()).toBe("");
  expect(result.frame).toContain("Abandon revision xyz?");
});
