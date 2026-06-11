import { testRender } from "@opentui/solid";
import { TextAttributes } from "@opentui/core";
import { createSignal } from "solid-js";
import { resolveAppConfig } from "../../src/config/index.ts";
import type { JjClient } from "../../src/jj/client.ts";
import { JjHelpCache } from "../../src/jj/helpCache.ts";
import type { AppStore } from "../../src/state/appStore.ts";
import { CommandPrompt } from "../../src/ui/prompts.tsx";

const config = resolveAppConfig({});

const TOP_HELP = `Jujutsu

Usage: jj [OPTIONS] <COMMAND>

Commands:
  log       Show revision history
  bookmark  Manage bookmarks [default alias: b]

Options:
  -h, --help  Print help
`;

const LOG_HELP = `Show revision history

Usage: jj log [OPTIONS] [FILESETS]...

Options:
  -r, --revision <REVSETS>  Which revisions to show
      --reversed            Show revisions in the opposite order
  -h, --help                Print help
`;

function makeClient(): JjClient {
  return {
    async runHelp(path: readonly string[]): Promise<string> {
      if (path.length === 0) return TOP_HELP;
      if (path.length === 1 && path[0] === "log") return LOG_HELP;
      return "";
    },
    async loadBookmarks() {
      return [];
    },
    async loadTags() {
      return [];
    },
    async loadAliases() {
      return {};
    },
  } as unknown as JjClient;
}

type Rendered = Awaited<ReturnType<typeof testRender>>;

async function settle(rendered: Rendered) {
  for (let i = 0; i < 12; i++) {
    await rendered.renderOnce();
    await Promise.resolve();
  }
}

function frameText(rendered: Rendered): string {
  return rendered.captureCharFrame();
}

function promptLine(rendered: Rendered): string {
  const lines = rendered.captureCharFrame().split("\n");
  return lines.find((line) => line.includes("│") || line.includes("║")) ?? "";
}

function rowBg(rendered: Rendered, needle: string): [number, number, number, number] | null {
  const spans = rendered.captureSpans();
  for (const line of spans.lines) {
    const span = line.spans.find((s) => s.text.includes(needle));
    if (span) {
      return span.bg.toInts();
    }
  }
  return null;
}

function rowAttrs(rendered: Rendered, needle: string): number | null {
  const spans = rendered.captureSpans();
  for (const line of spans.lines) {
    const span = line.spans.find((s) => s.text.includes(needle));
    if (span) {
      return span.attributes;
    }
  }
  return null;
}

const isUnderlined = (attrs: number | null) => ((attrs ?? 0) & TextAttributes.UNDERLINE) !== 0;

function mountPrompt(opts: {
  history: string[];
  kittyKeyboard?: boolean;
  historyDelayTicks?: number;
  onSubmit?: () => void;
}): Promise<Rendered> {
  const client = makeClient();
  const helpCache = new JjHelpCache(client);
  return testRender(
    () => {
      const [text, setText] = createSignal("");
      const store = {
        state: {},
        actions: { setCommandBarText: setText },
      } as unknown as AppStore;
      return (
        <CommandPrompt
          store={store}
          config={config}
          client={client}
          helpCache={helpCache}
          composeEnabled={true}
          workspaceRoot="/repo"
          loadHistory={async () => {
            for (let i = 0; i < (opts.historyDelayTicks ?? 0); i++) {
              await Promise.resolve();
            }
            return [...opts.history];
          }}
          commandText={text()}
          prefix="jj "
          placeholder="subcommand"
          onSubmit={() => opts.onSubmit?.()}
        />
      );
    },
    { width: 80, height: 14, kittyKeyboard: opts.kittyKeyboard ?? false },
  );
}

// No history -> opens in compose. The default Tab target (bottom flag) is
// underlined, not focused; nothing is inserted until Tab.
async function renderComposeFlags() {
  const rendered = await mountPrompt({ history: [] });
  try {
    await settle(rendered);
    const openFrame = frameText(rendered);
    const opensInCompose = openFrame.includes("Show revision history");
    const composeOpensWithDoubleBorder = openFrame.includes("═");

    await rendered.mockInput.typeText("log ");
    await settle(rendered);
    const flagFrame = frameText(rendered);
    const inputBeforeAccept = promptLine(rendered);
    const revisionAttrs = rowAttrs(rendered, "--revision");
    const revisionBg = rowBg(rendered, "--revision");
    const reversedBg = rowBg(rendered, "--reversed");

    rendered.mockInput.pressTab();
    await settle(rendered);
    const acceptedLine = promptLine(rendered);

    return {
      opensInComposeWhenNoHistory: opensInCompose,
      composeOpensWithDoubleBorder,
      flagListHasRevision: flagFrame.includes("--revision"),
      defaultTargetUnderlined: isUnderlined(revisionAttrs),
      nothingFocusedByDefault:
        revisionBg !== null && reversedBg !== null && JSON.stringify(revisionBg) === JSON.stringify(reversedBg),
      inputNotModifiedBeforeAccept: !inputBeforeAccept.includes("--revision"),
      tabAcceptsDefaultTarget: acceptedLine.includes("--revision"),
    };
  } finally {
    rendered.renderer.destroy();
  }
}

// Enter with no focused suggestion submits the command.
async function renderEnterSubmitsWhenUnfocused() {
  let submitted = false;
  const rendered = await mountPrompt({ history: [], onSubmit: () => (submitted = true) });
  try {
    await settle(rendered);
    await rendered.mockInput.typeText("log ");
    await settle(rendered);
    rendered.mockInput.pressEnter();
    await settle(rendered);
    return { enterSubmitsWhenUnfocused: submitted };
  } finally {
    rendered.renderer.destroy();
  }
}

// After navigating to a suggestion, Enter accepts it (inserts) instead of
// submitting.
async function renderEnterAcceptsWhenFocused() {
  let submitted = false;
  const rendered = await mountPrompt({ history: [], onSubmit: () => (submitted = true) });
  try {
    await settle(rendered);
    await rendered.mockInput.typeText("log ");
    await settle(rendered);
    rendered.mockInput.pressArrow("up"); // focus index 0 (--revision)
    rendered.mockInput.pressArrow("up"); // focus index 1 (--reversed)
    await settle(rendered);
    rendered.mockInput.pressEnter();
    await settle(rendered);
    const line = promptLine(rendered);
    return {
      enterAcceptsFocusedNotSubmits: !submitted && line.includes("--reversed"),
    };
  } finally {
    rendered.renderer.destroy();
  }
}

// With history -> opens in history; a bare ':' toggles to compose and back
// without ever inserting the ':' character.
async function renderHistoryDefaultAndColonToggle() {
  const rendered = await mountPrompt({ history: ["log -r @"] });
  try {
    await settle(rendered);
    const openFrame = frameText(rendered);

    await rendered.mockInput.typeText(":");
    await settle(rendered);
    const afterFirstColon = frameText(rendered);
    const afterFirstColonLine = promptLine(rendered);

    await rendered.mockInput.typeText(":");
    await settle(rendered);
    const afterSecondColon = frameText(rendered);

    return {
      opensInHistory: openFrame.includes("log -r @"),
      // Border convention: the history view uses the default single border;
      // the double border is reserved for compose (complete-at-point).
      historyUsesSingleBorder: !openFrame.includes("═"),
      composeUsesDoubleBorder: afterFirstColon.includes("═"),
      colonTogglesToCompose:
        afterFirstColon.includes("Show revision history") && !afterFirstColon.includes("-r @"),
      colonNotInserted: !afterFirstColonLine.includes(":"),
      colonTogglesBackToHistory: afterSecondColon.includes("log -r @"),
      historyAgainUsesSingleBorder: !afterSecondColon.includes("═"),
    };
  } finally {
    rendered.renderer.destroy();
  }
}

// Opening in history must NOT auto-focus the bottom (most recent) entry, even
// when help loads before history.
async function renderHistoryNoAutoFocus() {
  const rendered = await mountPrompt({ history: ["alpha-cmd", "beta-cmd"], historyDelayTicks: 6 });
  try {
    await settle(rendered);
    const topBg = rowBg(rendered, "beta-cmd");
    const bottomBg = rowBg(rendered, "alpha-cmd");
    return {
      historyEntriesShown: topBg !== null && bottomBg !== null,
      historyNotAutoFocused: JSON.stringify(topBg) === JSON.stringify(bottomBg),
      historyInputBlank: !promptLine(rendered).includes("alpha-cmd"),
    };
  } finally {
    rendered.renderer.destroy();
  }
}

// ctrl+h toggles to compose even with text already typed, preserving the text.
async function renderCtrlHWithText() {
  const rendered = await mountPrompt({ history: ["log -r @"], kittyKeyboard: true });
  try {
    await settle(rendered);
    await rendered.mockInput.typeText("lo");
    await settle(rendered);
    const historyView = frameText(rendered);

    rendered.mockInput.pressKey("h", { ctrl: true });
    await settle(rendered);
    const composeView = frameText(rendered);
    const composeLine = promptLine(rendered);

    return {
      ctrlHFromHistoryToCompose:
        historyView.includes("log -r @") && composeView.includes("Show revision history"),
      ctrlHPreservesText: composeLine.includes("lo"),
    };
  } finally {
    rendered.renderer.destroy();
  }
}

// The shell bar (composeEnabled=false) is unchanged: Tab navigates history.
async function renderShellTab() {
  const rendered = await testRender(
    () => {
      const [text, setText] = createSignal("p");
      const store = {
        state: {},
        actions: { setCommandBarText: setText },
      } as unknown as AppStore;
      return (
        <CommandPrompt
          store={store}
          config={config}
          composeEnabled={false}
          workspaceRoot="/repo"
          loadHistory={async () => ["pwd"]}
          commandText={text()}
          prefix="❯ "
          placeholder="shell command"
          onSubmit={() => {}}
        />
      );
    },
    { width: 80, height: 14 },
  );
  try {
    await settle(rendered);
    rendered.mockInput.pressTab();
    await settle(rendered);
    return { shellTabNavigatesHistory: promptLine(rendered).includes("pwd") };
  } finally {
    rendered.renderer.destroy();
  }
}

console.log(
  JSON.stringify({
    ...(await renderComposeFlags()),
    ...(await renderEnterSubmitsWhenUnfocused()),
    ...(await renderEnterAcceptsWhenFocused()),
    ...(await renderHistoryDefaultAndColonToggle()),
    ...(await renderHistoryNoAutoFocus()),
    ...(await renderCtrlHWithText()),
    ...(await renderShellTab()),
  }),
);
