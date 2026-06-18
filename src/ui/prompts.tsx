import { TextAttributes, type InputRenderable } from "@opentui/core";
import { For, Show, batch, createEffect, createMemo, createSignal, onMount } from "solid-js";
import { useKeyboard } from "@opentui/solid";
import { matchHistoryEntries } from "../history/store.ts";
import type { JjClient } from "../jj/client.ts";
import type { JjHelpCache } from "../jj/helpCache.ts";
import { buildCompletionItems, extractLastToken, matchCompletions, type CompletionItem } from "../revset/completions.ts";
import { formatFilesRevset, matchFileSearchPaths } from "../revset/files.ts";
import { resolveComposeContext, type ComposeContext } from "../commands/compose-context.ts";
import { buildComposeItems, computeComposeAccept } from "../commands/compose-completions.ts";
import type { AppStore } from "../state/appStore.ts";
import { getFocusedInsertArg, type CommandSegment } from "../state/store.ts";
import type { ResolvedAppConfig } from "../config/schema.ts";
import type { BookmarkSuggestion } from "../domain/types.ts";
import { AutocompleteList, type AutocompleteListItem } from "./AutocompleteList.tsx";
import {
  getAutocompleteAction,
  moveAutocompleteSelection,
  type AutocompleteFlow,
} from "./autocomplete.ts";

export type BookmarkPromptContext = Readonly<{
  initialCursorOffset: number;
  suggestions: readonly BookmarkSuggestion[];
}>;

export function CommandPrompt(props: {
  store: AppStore;
  config: ResolvedAppConfig;
  // Structured completion is an opt-in enhancement of the jj bar. When these are
  // omitted (or composeEnabled is false) the prompt behaves as a history bar.
  client?: JjClient;
  helpCache?: JjHelpCache;
  composeEnabled?: boolean;
  workspaceRoot: string | null;
  loadHistory: (workspaceRoot: string) => Promise<string[]>;
  removeHistory?: (workspaceRoot: string, entry: string) => Promise<string[]>;
  commandText: string;
  prefix: string;
  placeholder: string;
  onSubmit: (value: string) => void;
  onHeightChange?: (height: number) => void;
  bookmarkContext?: BookmarkPromptContext | null;
}) {
  const { store, config } = props;
  const colors = config.colorScheme.semanticColors;
  const flow: AutocompleteFlow = "bottom-to-top";
  const [historyEntries, setHistoryEntries] = createSignal<string[]>([]);
  const [draftText, setDraftText] = createSignal(props.commandText);
  const [cursorOffset, setCursorOffset] = createSignal<number>(
    props.bookmarkContext?.initialCursorOffset ?? props.commandText.length,
  );
  const [selectedIndex, setSelectedIndex] = createSignal<number | null>(null);
  const [pendingInitialSync, setPendingInitialSync] = createSignal(true);
  // The jj bar opens in command history when there is any, and in structured
  // "compose" completion otherwise. The two views toggle via ctrl+h, or via a
  // bare ':' typed into an empty input (see onInput). historyMode true === the
  // history view; compose is the jj-only structured completion.
  const [composeData, setComposeData] = createSignal<{
    revsetItems: readonly CompletionItem[];
    bookmarks: readonly string[];
  }>({ revsetItems: [], bookmarks: [] });
  const [historyMode, setHistoryMode] = createSignal(false);
  const [helpVersion, setHelpVersion] = createSignal(0);
  const composeActive = () => props.composeEnabled && !props.bookmarkContext && !historyMode();
  let input: InputRenderable | undefined;
  // The initial view is chosen once, after history first loads.
  let initialViewChosen = false;

  // Flip between history and compose. Switching INTO history is a no-op when
  // there is no history to show, so the jj bar never lands on an empty list.
  const toggleHistoryMode = () => {
    if (!historyMode() && historyEntries().length === 0) {
      return;
    }
    batch(() => {
      setHistoryMode((on) => !on);
      setSelectedIndex(null);
    });
  };

  onMount(() => {
    const client = props.client;
    if (!props.composeEnabled || !client) {
      return;
    }
    props.helpCache?.prefetchTopLevel();
    void (async () => {
      const [bookmarks, tags, aliases] = await Promise.all([
        client.loadBookmarks(),
        client.loadTags(),
        client.loadAliases(),
      ]);
      setComposeData({ revsetItems: buildCompletionItems(bookmarks, tags, aliases), bookmarks });
    })();
  });

  createEffect(() => {
    const workspaceRoot = props.workspaceRoot;

    if (!workspaceRoot || props.bookmarkContext) {
      setHistoryEntries([]);
      setSelectedIndex(null);
      return;
    }

    void props.loadHistory(workspaceRoot).then((entries) => {
      setHistoryEntries(entries);
      // On the jj bar, default to the history view when there is history, else
      // to compose. Chosen only once so it never overrides a manual toggle.
      // Clear any selection the compose auto-focus may have set during the brief
      // pre-history-load window, so the history view opens unfocused.
      if (props.composeEnabled && !initialViewChosen) {
        initialViewChosen = true;
        batch(() => {
          setHistoryMode(entries.length > 0);
          setSelectedIndex(null);
        });
      }
    });
  });

  createEffect(() => {
    const nextText = props.commandText;
    if (nextText !== draftText()) {
      batch(() => {
        setDraftText(nextText);
        setSelectedIndex(null);
        setCursorOffset(props.bookmarkContext?.initialCursorOffset ?? nextText.length);
        setPendingInitialSync(true);
      });
    }
  });

  const filteredHistory = createMemo(() => {
    if (props.bookmarkContext) return [];
    return matchHistoryEntries(draftText(), historyEntries());
  });

  const tokenAtCursor = createMemo(() => extractTokenAtCursor(draftText(), cursorOffset()));

  const filteredBookmarks = createMemo<readonly BookmarkSuggestion[]>(() => {
    const ctx = props.bookmarkContext;
    if (!ctx) return [];
    const { token } = tokenAtCursor();
    if (token.length === 0) return ctx.suggestions;
    const matches = ctx.suggestions.filter((s) => s.name.toLowerCase().includes(token.toLowerCase()));
    return matches.length > 0 ? matches : ctx.suggestions;
  });

  // What to complete at the cursor. Recomputes when help models arrive
  // (helpVersion) because path-walking consults the cache, which is non-reactive.
  const composeContext = createMemo<ComposeContext | null>(() => {
    if (!composeActive()) {
      return null;
    }
    helpVersion();
    return resolveComposeContext(draftText(), cursorOffset(), (path) => props.helpCache?.peek(path));
  });

  // Ensure the model for the resolved path — and each prefix the resolver needs
  // to descend through — is loaded. Each arrival bumps helpVersion, letting the
  // resolver descend one level further until it converges.
  createEffect(() => {
    const ctx = composeContext();
    const cache = props.helpCache;
    if (!ctx || !cache) {
      return;
    }
    for (let i = 0; i <= ctx.path.length; i++) {
      const prefix = ctx.path.slice(0, i);
      if (cache.peek(prefix) === undefined) {
        void cache.load(prefix).then(() => setHelpVersion((version) => version + 1));
      }
    }
  });

  const composeItems = createMemo<AutocompleteListItem[]>(() => {
    helpVersion();
    const ctx = composeContext();
    if (!ctx) {
      return [];
    }
    const data = composeData();
    return buildComposeItems({
      context: ctx,
      help: props.helpCache?.peek(ctx.path),
      revsetItems: data.revsetItems,
      bookmarks: data.bookmarks,
    });
  });

  // The first (bottom-most, index 0) suggestion is the default Tab target. It is
  // underlined rather than focused: focus is reserved for a suggestion the user
  // explicitly navigated to (which Enter then accepts instead of running the
  // command). No selection => underline the default; a selection => no hint.
  const tabHintIndex = createMemo<number | null>(() =>
    composeActive() && selectedIndex() === null && composeItems().length > 0 ? 0 : null,
  );

  // Insert the suggestion at `index` at the cursor and reveal the next-context
  // list. Shared by Tab and by Enter-on-a-focused-suggestion.
  const acceptComposeSuggestion = (index: number): boolean => {
    const ctx = composeContext();
    const item = composeItems()[index];
    if (!ctx || !item || !input) {
      return false;
    }
    const accept = computeComposeAccept({ text: draftText(), context: ctx, item });
    input.setText(accept.text);
    input.cursorOffset = accept.cursorOffset;
    batch(() => {
      setDraftText(accept.text);
      setSelectedIndex(null);
      setCursorOffset(accept.cursorOffset);
      store.actions.setCommandBarText(accept.text);
    });
    return true;
  };

  const autocompleteItems = createMemo<AutocompleteListItem[]>(() => {
    if (props.bookmarkContext) {
      return filteredBookmarks().map((s) => ({
        id: `bookmark:${s.name}`,
        tag: "bm",
        text: s.name,
      }));
    }
    if (composeActive()) {
      return composeItems();
    }
    return filteredHistory().map((entry) => ({
      id: entry,
      text: entry,
    }));
  });

  const displayedText = createMemo(() => {
    // Compose mode does not live-preview the highlighted row into the input;
    // Tab commits it instead. This keeps multi-token commands readable.
    if (composeActive()) {
      return draftText();
    }

    const index = selectedIndex();
    if (index === null) {
      return draftText();
    }

    if (props.bookmarkContext) {
      const suggestion = filteredBookmarks()[index];
      if (!suggestion) return draftText();
      const { start, end } = tokenAtCursor();
      return draftText().slice(0, start) + suggestion.name + draftText().slice(end);
    }

    return filteredHistory()[index] ?? draftText();
  });

  const displayedCursorOffset = createMemo<number | null>(() => {
    if (pendingInitialSync()) {
      return props.bookmarkContext?.initialCursorOffset ?? draftText().length;
    }
    // Compose mode positions the cursor explicitly on Tab-accept (and on input),
    // so leave the synced cursor alone otherwise.
    if (composeActive()) {
      return null;
    }
    const index = selectedIndex();
    if (index !== null && props.bookmarkContext) {
      const suggestion = filteredBookmarks()[index];
      if (suggestion) {
        const { start } = tokenAtCursor();
        return start + suggestion.name.length;
      }
    }
    return null;
  });

  createEffect(() => {
    const cursor = displayedCursorOffset();
    syncPromptInput(input, displayedText(), cursor === null ? undefined : cursor);
    if (pendingInitialSync()) {
      setPendingInitialSync(false);
    }
  });

  useKeyboard((event) => {
    if (event.eventType === "release") {
      return;
    }

    // ctrl+h toggles between command history and structured completion on the
    // jj bar, regardless of what is already typed.
    if (props.composeEnabled && !props.bookmarkContext && event.ctrl && event.name === "h") {
      event.preventDefault();
      toggleHistoryMode();
      return;
    }

    // Tab accepts the underlined default (or the focused suggestion, if the user
    // navigated to one) and reveals the next-context list. Navigation stays on
    // arrows/ctrl-nav and shift+Tab, which fall through to getAutocompleteAction.
    if (composeActive() && event.name === "tab" && !event.shift) {
      if (composeItems().length === 0) {
        return;
      }
      event.preventDefault();
      acceptComposeSuggestion(selectedIndex() ?? 0);
      return;
    }

    const itemCount = autocompleteItems().length;
    const action = getAutocompleteAction(event, flow);
    if (action !== null && itemCount > 0) {
      event.preventDefault();
      setSelectedIndex((currentIndex) =>
        moveAutocompleteSelection(currentIndex, itemCount, action)
      );
      return;
    }

    if (event.ctrl && event.name === "x" && !props.bookmarkContext && !composeActive()) {
      const index = selectedIndex();
      if (index === null) return;
      const entry = filteredHistory()[index];
      if (entry === undefined) return;
      event.preventDefault();
      removeHistoryEntryAtIndex({
        entry,
        currentIndex: index,
        historyEntries: historyEntries(),
        visibleCountAfterRemoval: (remaining) => matchHistoryEntries(draftText(), remaining).length,
        setHistoryEntries,
        setSelectedIndex,
        workspaceRoot: props.workspaceRoot,
        removeHistory: props.removeHistory,
      });
      return;
    }

    if (event.ctrl && event.name === "'" && input) {
      const arg = getFocusedInsertArg(store.state);
      if (arg) {
        event.preventDefault();
        input.insertText(arg);
        const nextText = input.plainText;
        const nextCursor = input.cursorOffset;
        batch(() => {
          setDraftText(nextText);
          setSelectedIndex(null);
          setCursorOffset(nextCursor);
          store.actions.setCommandBarText(nextText);
        });
        return;
      }
    }

    if (event.name === "return") {
      event.preventDefault();
      // A focused compose suggestion exists only because the user navigated to
      // it, so Enter accepts it (same as Tab) rather than running the command.
      if (composeActive() && selectedIndex() !== null) {
        acceptComposeSuggestion(selectedIndex()!);
        return;
      }
      const finalText = displayedText();
      batch(() => {
        setDraftText(finalText);
        setSelectedIndex(null);
        setCursorOffset(displayedCursorOffset() ?? finalText.length);
        store.actions.setCommandBarText(finalText);
      });
      props.onSubmit(finalText);
      return;
    }
  }, { release: true });

  return (
    <PromptShell
      config={config}
      items={autocompleteItems()}
      selectedIndex={selectedIndex()}
      underlineIndex={tabHintIndex()}
      flow={flow}
      focused
      // Double border is the app-wide signal for complete-at-point (structured
      // completion); the history view uses the default single border. See
      // spec/ux-philosophy.md ("Reserve the Double Border for Complete-at-Point").
      borderStyle={composeActive() ? "double" : "single"}
      onHeightChange={props.onHeightChange}
    >
      <box width={Array.from(props.prefix).length} flexDirection="row" flexShrink={0}>
        <text fg={colors.textPrimary}>{props.prefix}</text>
      </box>
      <input
        ref={(el: InputRenderable) => {
          input = el;
          el.editorView.setScrollMargin(0);
          const cursor = displayedCursorOffset();
          syncPromptInput(el, displayedText(), cursor === null ? undefined : cursor);
          setPendingInitialSync(false);
        }}
        flexGrow={1}
        marginRight={1}
        placeholder={props.placeholder}
        focused
        textColor={colors.textPrimary}
        focusedTextColor={colors.textPrimary}
        placeholderColor={colors.textQuaternary}
        cursorColor={colors.chromeBorderFocus}
        cursorStyle={{ style: "line" }}
        onInput={(value) => {
          // A bare ':' (the first-and-only character) is a mode-toggle command,
          // not content: swallow it and flip history <-> compose.
          if (props.composeEnabled && !props.bookmarkContext && value === ":") {
            input?.setText("");
            toggleHistoryMode();
            batch(() => {
              setDraftText("");
              setSelectedIndex(null);
              setCursorOffset(0);
              store.actions.setCommandBarText("");
            });
            return;
          }
          batch(() => {
            setDraftText(value);
            setSelectedIndex(null);
            const nextCursor = input?.cursorOffset ?? value.length;
            setCursorOffset(nextCursor);
            store.actions.setCommandBarText(value);
          });
        }}
      />
    </PromptShell>
  );
}

function extractTokenAtCursor(text: string, cursor: number): { start: number; end: number; token: string } {
  const safeCursor = Math.max(0, Math.min(cursor, text.length));
  let start = safeCursor;
  while (start > 0 && !/\s/.test(text[start - 1]!)) {
    start -= 1;
  }
  let end = safeCursor;
  while (end < text.length && !/\s/.test(text[end]!)) {
    end += 1;
  }
  return { start, end, token: text.slice(start, end) };
}

export function CommandPreview(props: {
  config: ResolvedAppConfig;
  commandSegments: readonly CommandSegment[];
  onHeightChange?: (height: number) => void;
}) {
  const colors = props.config.colorScheme.semanticColors;

  return (
    <PromptShell
      config={props.config}
      items={[]}
      selectedIndex={null}
      flow="bottom-to-top"
      focused={false}
      onHeightChange={props.onHeightChange}
    >
      <box width={3} flexDirection="row" flexShrink={0}>
        <text fg={colors.textTertiary}>jj </text>
      </box>
      <box flexGrow={1} flexDirection="row">
        <For each={props.commandSegments}>
          {(segment) => (
            <text
              fg={segment.style === "selected" || segment.style === "files"
                ? colors.rowSelectedAccent
                : segment.style === "target"
                  ? colors.chromeBorderFocus
                  : segment.style === "placeholder"
                    ? colors.chromeBorderFocus
                    : colors.textPrimary}
              bg={segment.style === "files" ? colors.rowSelectedFill : undefined}
              attributes={segment.style !== "command" ? TextAttributes.BOLD : undefined}
            >
              {segment.text}
            </text>
          )}
        </For>
      </box>
    </PromptShell>
  );
}

export function SearchPrompt(props: {
  store: AppStore;
  config: ResolvedAppConfig;
  focused: boolean;
  searchQuery: string;
  searchIdOnly: boolean;
  onHeightChange?: (height: number) => void;
}) {
  const { store, config } = props;
  const colors = config.colorScheme.semanticColors;

  useKeyboard((event) => {
    if (event.eventType === "release") {
      return;
    }

    if (event.name === "return") {
      event.preventDefault();
      store.actions.finalizeSearch();
      return;
    }
  }, { release: true });

  const prefix = createMemo(() => (props.searchIdOnly ? "id " : "/ "));

  return (
    <PromptShell
      config={config}
      items={[]}
      selectedIndex={null}
      flow="bottom-to-top"
      focused={props.focused}
      onHeightChange={props.onHeightChange}
    >
      <box width={Array.from(prefix()).length} flexDirection="row" flexShrink={0}>
        <text fg={props.searchIdOnly ? colors.chromeBorderFocus : colors.textPrimary}>{prefix()}</text>
      </box>
      <input
        ref={(el: InputRenderable) => {
          el.editorView.setScrollMargin(0);
        }}
        flexGrow={1}
        marginRight={1}
        value={props.searchQuery}
        placeholder="search"
        focused={props.focused}
        textColor={colors.textPrimary}
        focusedTextColor={colors.textPrimary}
        placeholderColor={colors.textQuaternary}
        cursorColor={colors.chromeBorderFocus}
        cursorStyle={{ style: "line" }}
        onInput={(value) => {
          store.actions.setSearchText(value);
        }}
      />
    </PromptShell>
  );
}

export function FileSearchPrompt(props: {
  client: Pick<JjClient, "loadKnownFiles">;
  config: ResolvedAppConfig;
  onApply: (query: string) => void | Promise<void>;
  onEditRevset: (query: string) => void | Promise<void>;
  onCancel: () => void;
  onHeightChange?: (height: number) => void;
}) {
  const colors = props.config.colorScheme.semanticColors;
  const flow: AutocompleteFlow = "bottom-to-top";
  const [text, setText] = createSignal("");
  const [files, setFiles] = createSignal<readonly string[]>([]);
  const [selectedIndex, setSelectedIndex] = createSignal<number | null>(null);
  let input: InputRenderable | undefined;

  const suggestions = createMemo<AutocompleteListItem[]>(() =>
    matchFileSearchPaths(text(), files()).map((path) => ({
      id: `file:${path}`,
      tag: "file",
      text: path,
    }))
  );

  const selectedPath = createMemo(() => {
    const items = suggestions();
    if (items.length === 0) {
      const raw = text().trim();
      return raw.length > 0 ? raw : null;
    }
    return items[selectedIndex() ?? 0]?.text ?? null;
  });

  onMount(() => {
    void (async () => {
      const paths = await props.client.loadKnownFiles();
      setFiles(paths);
    })();
  });

  createEffect(() => {
    if (suggestions().length > 0) {
      setSelectedIndex((current) => current ?? 0);
    } else {
      setSelectedIndex(null);
    }
  });

  createEffect(() => {
    syncPromptInput(input, text());
  });

  const applySelected = (handler: (query: string) => void | Promise<void>) => {
    const path = selectedPath();
    if (!path) {
      return;
    }
    void handler(formatFilesRevset(path));
  };

  useKeyboard((event) => {
    if (event.eventType === "release" || event.meta || event.option) {
      return;
    }

    if (event.ctrl && event.name === "l") {
      event.preventDefault();
      applySelected(props.onEditRevset);
      return;
    }

    const action = getAutocompleteAction(event, flow);
    if (action !== null) {
      event.preventDefault();
      setSelectedIndex((currentIndex) =>
        moveAutocompleteSelection(currentIndex, suggestions().length, action)
      );
      return;
    }

    if (event.name === "return") {
      event.preventDefault();
      applySelected(props.onApply);
      return;
    }

    if (event.name === "escape") {
      event.preventDefault();
      props.onCancel();
      return;
    }
  }, { release: true });

  return (
    <PromptShell
      config={props.config}
      items={suggestions()}
      selectedIndex={selectedIndex()}
      flow={flow}
      focused
      onHeightChange={props.onHeightChange}
    >
      <text fg={colors.textTertiary}>File: </text>
      <input
        ref={(el: InputRenderable) => {
          input = el;
          el.editorView.setScrollMargin(0);
          syncPromptInput(el, text());
        }}
        flexGrow={1}
        marginRight={1}
        focused
        placeholder="path"
        textColor={colors.textPrimary}
        focusedTextColor={colors.textPrimary}
        placeholderColor={colors.textQuaternary}
        cursorColor={colors.chromeBorderFocus}
        cursorStyle={{ style: "line" }}
        onInput={(value) => {
          batch(() => {
            setText(value);
            setSelectedIndex(null);
          });
        }}
      />
    </PromptShell>
  );
}

export function RevsetPrompt(props: {
  revsetQuery: string;
  initialQuery?: string | null;
  client: JjClient;
  config: ResolvedAppConfig;
  workspaceRoot: string | null;
  loadHistory: (workspaceRoot: string) => Promise<string[]>;
  removeHistory?: (workspaceRoot: string, entry: string) => Promise<string[]>;
  onApply: (query: string) => void | Promise<void>;
  onCancel: () => void;
  onHeightChange?: (height: number) => void;
}) {
  const colors = props.config.colorScheme.semanticColors;
  const flow: AutocompleteFlow = "bottom-to-top";
  const [text, setText] = createSignal(props.initialQuery ?? props.revsetQuery);
  const [completionItems, setCompletionItems] = createSignal<CompletionItem[]>([]);
  const [historyEntries, setHistoryEntries] = createSignal<string[]>([]);
  const [historyMode, setHistoryMode] = createSignal(false);
  const [selectedIndex, setSelectedIndex] = createSignal<number | null>(null);
  let input: InputRenderable | undefined;

  // History mode (toggled with ctrl+l) lists previously applied revsets instead
  // of revset-function completions. An empty input also falls back to history so
  // there is always something useful to show.
  const showsHistory = createMemo(() => historyMode() || text().trim().length === 0);

  // The entry equal to the active revset is dropped: switching to the revset you
  // are already on is a no-op. The revset you switched away from is recorded as
  // the most recent entry on apply, so it surfaces at the bottom of this list.
  const visibleHistory = createMemo(() => {
    const current = props.revsetQuery.trim();
    return historyEntries().filter((entry) => entry !== current);
  });

  const suggestions = createMemo<AutocompleteListItem[]>(() => {
    if (showsHistory()) {
      // The revset prompt opens pre-filled with the active revset, so filtering
      // the history by that text would usually hide everything. Show the full
      // list and let the user browse it; selecting an entry replaces the input.
      return visibleHistory().map((entry) => ({
        id: `history:${entry}`,
        tag: "hs",
        text: entry,
      }));
    }

    const { token } = extractLastToken(text());
    return matchCompletions(token, completionItems()).map((item) => ({
      id: `completion:${item.kind}:${item.name}`,
      tag: completionKindLabel(item.kind),
      text: item.name,
      detail: item.detail,
    }));
  });

  onMount(() => {
    void (async () => {
      const [bookmarks, tags, aliases, history] = await Promise.all([
        props.client.loadBookmarks(),
        props.client.loadTags(),
        props.client.loadAliases(),
        props.workspaceRoot
          ? props.loadHistory(props.workspaceRoot)
          : Promise.resolve([]),
      ]);
      setCompletionItems(buildCompletionItems(bookmarks, tags, aliases));
      setHistoryEntries(history);
    })();
  });

  // Whenever the history list is the one on screen, pre-focus its bottom entry
  // (index 0, the most recently used revset). With bottom-to-top flow that is
  // the entry nearest the input, so Enter immediately switches to it. Only fills
  // an empty selection, so it never fights the user's own navigation.
  createEffect(() => {
    if (showsHistory() && suggestions().length > 0) {
      setSelectedIndex((current) => current ?? 0);
    }
  });

  const displayedText = createMemo(() => {
    const index = selectedIndex();
    if (index === null) {
      return text();
    }

    const item = suggestions()[index];
    if (!item) {
      return text();
    }

    return getRevsetSuggestionText(text(), item, completionItems()) ?? text();
  });

  createEffect(() => {
    syncPromptInput(input, displayedText());
  });

  useKeyboard((event) => {
    if (event.eventType === "release" || event.meta || event.option) {
      return;
    }

    // ctrl+l toggles history: the revset prompt opens on ctrl+l, so double-tapping
    // l without releasing ctrl switches to the history list. Entering history mode
    // with nothing to show is a silent no-op.
    if (event.ctrl && event.name === "l") {
      event.preventDefault();
      if (!historyMode() && visibleHistory().length === 0) {
        return;
      }
      batch(() => {
        setHistoryMode((on) => !on);
        setSelectedIndex(null);
      });
      return;
    }

    const action = getAutocompleteAction(event, flow);
    if (action !== null) {
      event.preventDefault();
      setSelectedIndex((currentIndex) =>
        moveAutocompleteSelection(currentIndex, suggestions().length, action)
      );
      return;
    }

    if (event.ctrl && event.name === "x") {
      const index = selectedIndex();
      if (index === null) return;
      const item = suggestions()[index];
      if (!item || item.tag !== "hs") return;
      event.preventDefault();
      removeHistoryEntryAtIndex({
        entry: item.text,
        currentIndex: index,
        historyEntries: historyEntries(),
        visibleCountAfterRemoval: (remaining) => remaining.length,
        setHistoryEntries,
        setSelectedIndex,
        workspaceRoot: props.workspaceRoot,
        removeHistory: props.removeHistory,
      });
      return;
    }

    if (event.name === "return") {
      event.preventDefault();
      void props.onApply(displayedText());
      return;
    }

    if (event.name === "escape") {
      event.preventDefault();
      props.onCancel();
      return;
    }
  }, { release: true });

  return (
    <PromptShell
      config={props.config}
      items={suggestions()}
      selectedIndex={selectedIndex()}
      flow={flow}
      focused
      // Double border marks complete-at-point (revset-token completion); the
      // history fallback uses the default single border. See spec/ux-philosophy.md
      // ("Reserve the Double Border for Complete-at-Point").
      borderStyle={showsHistory() ? "single" : "double"}
      onHeightChange={props.onHeightChange}
    >
      <Show when={text().length === 0}>
        <text fg={colors.textTertiary}>Revset: </text>
      </Show>
      <input
        ref={(el: InputRenderable) => {
          input = el;
          el.editorView.setScrollMargin(0);
          syncPromptInput(el, displayedText());
        }}
        flexGrow={1}
        marginRight={1}
        focused
        textColor={colors.textPrimary}
        focusedTextColor={colors.textPrimary}
        cursorColor={colors.chromeBorderFocus}
        cursorStyle={{ style: "line" }}
        onInput={(value) => {
          batch(() => {
            setText(value);
            setSelectedIndex(null);
          });
        }}
      />
    </PromptShell>
  );
}

function PromptShell(props: {
  config: ResolvedAppConfig;
  items: readonly AutocompleteListItem[];
  selectedIndex: number | null;
  underlineIndex?: number | null;
  flow: AutocompleteFlow;
  focused: boolean;
  borderStyle?: "single" | "double";
  onHeightChange?: (height: number) => void;
  children: any;
}) {
  const colors = props.config.colorScheme.semanticColors;
  const autocompleteHeight = createMemo(() => Math.min(props.items.length, 10));
  const totalHeight = createMemo(() =>
    3 + autocompleteHeight() + (props.items.length > 0 ? 1 : 0)
  );

  createEffect(() => {
    props.onHeightChange?.(totalHeight());
  });

  return (
    <box
      width="100%"
      height={totalHeight()}
      flexDirection="column"
    >
      <Show when={props.items.length > 0}>
        <AutocompleteList
          items={props.items}
          selectedIndex={props.selectedIndex}
          underlineIndex={props.underlineIndex}
          flow={props.flow}
          config={props.config}
        />
      </Show>
      <box
        width="100%"
        height={3}
        flexDirection="row"
        paddingX={1}
        border
        borderStyle={props.borderStyle ?? "single"}
        borderColor={props.focused ? colors.chromeBorderFocus : colors.chromeBorderIdle}
        backgroundColor={props.focused ? colors.chromeFillTwo : colors.chromeFillOne}
      >
        {props.children}
      </box>
    </box>
  );
}

function getRevsetSuggestionText(
  currentText: string,
  item: AutocompleteListItem,
  completionItems: readonly CompletionItem[],
): string | null {
  if (item.tag === "hs") {
    return item.text;
  }

  const completion = completionItems.find((candidate) => candidate.name === item.text);
  if (!completion) {
    return null;
  }

  const { start } = extractLastToken(currentText);
  let nextValue = completion.name;
  if (completion.kind === "function") {
    nextValue += completion.hasParameters ? "(" : "()";
  }

  return currentText.slice(0, start) + nextValue;
}

function syncPromptInput(input: InputRenderable | undefined, text: string, cursorOffset?: number) {
  if (!input) {
    return;
  }

  const textChanged = input.plainText !== text;
  if (textChanged) {
    input.setText(text);
  }

  if (cursorOffset === undefined) {
    if (textChanged) {
      input.cursorOffset = text.length;
    }
    return;
  }

  const target = Math.max(0, Math.min(cursorOffset, text.length));
  if (input.cursorOffset !== target) {
    input.cursorOffset = target;
  }
}

function removeHistoryEntryAtIndex(args: {
  entry: string;
  currentIndex: number;
  historyEntries: readonly string[];
  visibleCountAfterRemoval: (remaining: readonly string[]) => number;
  setHistoryEntries: (entries: string[]) => void;
  setSelectedIndex: (index: number | null) => void;
  workspaceRoot: string | null;
  removeHistory?: (workspaceRoot: string, entry: string) => Promise<string[]>;
}): void {
  const remaining = args.historyEntries.filter((entry) => entry !== args.entry);
  const visibleCount = args.visibleCountAfterRemoval(remaining);
  batch(() => {
    args.setHistoryEntries(remaining);
    if (visibleCount === 0) {
      args.setSelectedIndex(null);
    } else if (args.currentIndex >= visibleCount) {
      args.setSelectedIndex(visibleCount - 1);
    }
  });
  if (args.workspaceRoot && args.removeHistory) {
    void args.removeHistory(args.workspaceRoot, args.entry);
  }
}

function completionKindLabel(kind: CompletionItem["kind"]): string {
  switch (kind) {
    case "function": return "fn";
    case "bookmark": return "bm";
    case "tag": return "tg";
    case "alias": return "al";
  }
}
