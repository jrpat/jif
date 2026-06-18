import { expect, test } from "bun:test";

test("FileSearchPrompt shows fuzzy file suggestions and applies the selected file revset", async () => {
  const proc = Bun.spawn({
    cmd: ["bun", "run", "test/helpers/renderFileSearchPrompt.tsx"],
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
    apply: {
      initialFrame: string;
      filteredFrame: string;
      applied: string[];
      edited: string[];
    };
    edit: {
      applied: string[];
      edited: string[];
    };
  };

  expect(result.apply.initialFrame).toContain("README.md");
  expect(result.apply.filteredFrame).toContain("src/revset/completions.ts");
  expect(result.apply.filteredFrame).not.toContain("README.md");
  expect(result.apply.applied).toEqual(['files("src/revset/completions.ts")']);
  expect(result.apply.edited).toEqual([]);

  expect(result.edit.applied).toEqual([]);
  expect(result.edit.edited).toEqual(['files("docs/guide.md")']);
}, 20000);
