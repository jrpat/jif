import { expect, test } from "bun:test";

// Renders the real CommandPrompt through OpenTUI's testRender so the assertions
// cover the actual <textarea wrapMode="word"> wrapping, not just the wrap math.
test("CommandPrompt wraps and submits long commands without corrupting history drafts", async () => {
  const proc = Bun.spawn({
    cmd: ["bun", "run", "test/helpers/renderCommandPromptWrap.tsx"],
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
    wrap: {
      plainText: string;
      virtualLineCount: number;
      taHeightWhenEmpty: number;
      taHeightWhenWrapped: number;
      heightWhenEmpty: number;
      heightWhenWrapped: number;
      submitted: string | null;
      plainTextAfterEnter: string;
      hyphenTaHeight: number;
      hyphenVirtualLineCount: number;
      cappedTaHeight: number;
      cappedHeight: number;
    };
    guard: { draft: string; previewed: string; afterDown: string };
  };

  const command =
    "one two three four five six seven eight nine ten eleven twelve thirteen";

  // The command wraps to three visual rows in the 32-column text area...
  expect(result.wrap.plainText).toBe(command);
  expect(result.wrap.virtualLineCount).toBe(3);
  // ...and the text area auto-grows to fit them (one row when empty, three wrapped).
  expect(result.wrap.taHeightWhenEmpty).toBe(1);
  expect(result.wrap.taHeightWhenWrapped).toBe(3);
  // The shell reports its measured height (rows + top/bottom border).
  expect(result.wrap.heightWhenEmpty).toBe(3);
  expect(result.wrap.heightWhenWrapped).toBe(5);

  // Enter submits the whole command; no literal newline is inserted.
  expect(result.wrap.submitted).toBe(command);
  expect(result.wrap.plainTextAfterEnter).toBe(command);

  // A hyphen-heavy command wraps by OpenTUI's own rules; the rendered text area
  // height matches its wrap exactly (the box grows to fit, not to our estimate).
  expect(result.wrap.hyphenTaHeight).toBe(result.wrap.hyphenVirtualLineCount);
  expect(result.wrap.hyphenTaHeight).toBeGreaterThan(1);

  // Growth caps at half the 16-row terminal; the measured shell adds its borders.
  expect(result.wrap.cappedTaHeight).toBe(8);
  expect(result.wrap.cappedHeight).toBe(10);

  // Previewing a history entry must not overwrite the draft the user typed.
  expect(result.guard.draft).toBe("status");
  expect(result.guard.previewed).toBe("status --long");
  expect(result.guard.afterDown).toBe("status");
}, 20000);
