import { expect, test } from "bun:test";

test("compose command bar: defaults to complete-at-point, toggles with ':'/ctrl+h, completes flags, and leaves the shell bar unchanged", async () => {
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

  // The bar opens straight into structured completion, which — being the
  // default view — carries the plain single border.
  expect(result.opensInComposeWhenNoHistory).toBe(true);
  expect(result.composeOpensWithSingleBorder).toBe(true);
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

  // Existing history does not change the default view, and a bare ':' (the
  // first-and-only character) toggles to history and back without inserting
  // ':'. History is the alternate view, so it is the one with the double border.
  expect(result.opensInComposeWithHistory).toBe(true);
  expect(result.composeUsesSingleBorder).toBe(true);
  expect(result.historyUsesDoubleBorder).toBe(true);
  expect(result.colonTogglesToHistory).toBe(true);
  expect(result.colonNotInserted).toBe(true);
  expect(result.colonTogglesBackToCompose).toBe(true);
  expect(result.composeAgainUsesSingleBorder).toBe(true);

  // The history view opens unfocused (Enter runs the blank/typed input, not the
  // most recent history entry), even when help loads before history.
  expect(result.historyEntriesShown).toBe(true);
  expect(result.historyNotAutoFocused).toBe(true);
  expect(result.historyInputBlank).toBe(true);

  // ctrl+h toggles even with text typed, preserving the text.
  expect(result.ctrlHFromComposeToHistory).toBe(true);
  expect(result.ctrlHPreservesText).toBe(true);

  // `bookmark track` loads the broader all-remotes list lazily and offers each
  // exact remote symbol, including bookmarks from more than one remote.
  expect(result.trackShowsAllRemoteBookmarks).toBe(true);

  // The shell bar has only the history view: it opens there, keeps the single
  // border (nothing is "alternate" when there is one view), and Tab navigates.
  expect(result.shellOpensInHistory).toBe(true);
  expect(result.shellUsesSingleBorder).toBe(true);
  expect(result.shellTabNavigatesHistory).toBe(true);
}, 30000);
