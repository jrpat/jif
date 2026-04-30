import { expect, test } from "bun:test";

test("prompt autocomplete navigation previews selections and restores the typed draft when deselected", async () => {
  const proc = Bun.spawn({
    cmd: ["bun", "run", "test/helpers/renderPromptAutocompleteNavigation.tsx"],
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

  const result = JSON.parse(stdout) as {
    command: {
      initialLine: string;
      firstPreview: string | null;
      secondPreview: string | null;
      restoredLine: string;
      editedLine: string;
      editedText: string | null;
    };
    revset: {
      initialLine: string;
      firstPreview: string | null;
      secondPreview: string | null;
      restoredLine: string;
    };
  };

  expect(result.command.initialLine).toContain("zz");
  expect(result.command.firstPreview).not.toBeNull();
  expect(result.command.secondPreview).not.toBeNull();
  expect(result.command.secondPreview).not.toBe(result.command.firstPreview);
  expect(result.command.restoredLine).toContain("zz");
  expect(result.command.editedText).not.toBeNull();
  expect(result.command.editedLine).toContain(result.command.editedText!);

  expect(result.revset.initialLine).toContain("zz");
  expect(result.revset.firstPreview).not.toBeNull();
  expect(result.revset.secondPreview).not.toBeNull();
  expect(result.revset.secondPreview).not.toBe(result.revset.firstPreview);
  expect(result.revset.restoredLine).toContain("zz");
}, 20000);