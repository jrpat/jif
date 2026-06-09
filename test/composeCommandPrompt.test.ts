import { expect, test } from "bun:test";

test("compose command bar: defaults by history, toggles with ':'/ctrl+h, completes flags, and leaves the shell bar unchanged", async () => {
  const proc = Bun.spawn({
    cmd: ["bun", "run", "test/helpers/renderComposeCommandPrompt.tsx"],
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

  const result = JSON.parse(stdout) as Record<string, boolean>;

  // With no history the bar opens straight into structured completion.
  expect(result.opensInComposeWhenNoHistory).toBe(true);
  // Typing `log ` lists that command's flags. The default Tab target (bottom
  // row) is underlined, not focused, and nothing is inserted until Tab.
  expect(result.flagListHasRevision).toBe(true);
  expect(result.defaultTargetUnderlined).toBe(true);
  expect(result.nothingFocusedByDefault).toBe(true);
  expect(result.inputNotModifiedBeforeAccept).toBe(true);
  expect(result.tabAcceptsDefaultTarget).toBe(true);

  // Enter submits when nothing is focused, but accepts a suggestion the user
  // navigated to (inserting it instead of running the command).
  expect(result.enterSubmitsWhenUnfocused).toBe(true);
  expect(result.enterAcceptsFocusedNotSubmits).toBe(true);

  // With history the bar opens in history (double border), and a bare ':' (the
  // first-and-only character) toggles to compose and back without inserting ':'.
  expect(result.opensInHistory).toBe(true);
  expect(result.opensWithDoubleBorder).toBe(true);
  expect(result.colonTogglesToCompose).toBe(true);
  expect(result.colonNotInserted).toBe(true);
  expect(result.colonTogglesBackToHistory).toBe(true);

  // The history view opens unfocused (Enter runs the blank/typed input, not the
  // most recent history entry), even when help loads before history.
  expect(result.historyEntriesShown).toBe(true);
  expect(result.historyNotAutoFocused).toBe(true);
  expect(result.historyInputBlank).toBe(true);

  // ctrl+h toggles even with text typed, preserving the text.
  expect(result.ctrlHFromHistoryToCompose).toBe(true);
  expect(result.ctrlHPreservesText).toBe(true);

  // The shell bar keeps Tab as history navigation.
  expect(result.shellTabNavigatesHistory).toBe(true);
}, 30000);
