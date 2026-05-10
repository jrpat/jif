import { TextAttributes, type InputRenderable } from "@opentui/core";
import { For, Show, batch, createEffect, createMemo, createSignal, onMount } from "solid-js";
import { useKeyboard } from "@opentui/solid";
import { matchHistoryEntries } from "../history/store.ts";
import type { JjClient } from "../jj/client.ts";
import { buildCompletionItems, extractLastToken, matchCompletions, type CompletionItem } from "../revset/completions.ts";
import type { AppStore } from "../state/appStore.ts";
import { getFocusedRevisionArg, type CommandSegment } from "../state/store.ts";
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
  workspaceRoot: string | null;
  loadHistory: (workspaceRoot: string) => Promise<string[]>;
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
  let input: InputRenderable | undefined;

  createEffect(() => {
    const workspaceRoot = props.workspaceRoot;

    if (!workspaceRoot || props.bookmarkContext) {
      setHistoryEntries([]);
      setSelectedIndex(null);
      return;
    }

    void props.loadHistory(workspaceRoot).then(setHistoryEntries);
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

  const autocompleteItems = createMemo<AutocompleteListItem[]>(() => {
    if (props.bookmarkContext) {
      return filteredBookmarks().map((s) => ({
        id: `bookmark:${s.name}`,
        tag: "bm",
        text: s.name,
      }));
    }
    return filteredHistory().map((entry) => ({
      id: entry,
      text: entry,
    }));
  });

  const displayedText = createMemo(() => {
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

    const itemCount = props.bookmarkContext ? filteredBookmarks().length : filteredHistory().length;
    const action = getAutocompleteAction(event, flow);
    if (action !== null && itemCount > 0) {
      event.preventDefault();
      setSelectedIndex((currentIndex) =>
        moveAutocompleteSelection(currentIndex, itemCount, action)
      );
      return;
    }

    if (event.ctrl && event.name === "'" && input) {
      const arg = getFocusedRevisionArg(store.state);
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
      flow={flow}
      focused
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

  return (
    <PromptShell
      config={config}
      items={[]}
      selectedIndex={null}
      flow="bottom-to-top"
      focused={props.focused}
      onHeightChange={props.onHeightChange}
    >
      <box width={2} flexDirection="row" flexShrink={0}>
        <text fg={colors.textPrimary}>/ </text>
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

export function RevsetPrompt(props: {
  revsetQuery: string;
  client: JjClient;
  config: ResolvedAppConfig;
  workspaceRoot: string | null;
  loadHistory: (workspaceRoot: string) => Promise<string[]>;
  onApply: (query: string) => void | Promise<void>;
  onCancel: () => void;
  onHeightChange?: (height: number) => void;
}) {
  const colors = props.config.colorScheme.semanticColors;
  const flow: AutocompleteFlow = "bottom-to-top";
  const [text, setText] = createSignal(props.revsetQuery);
  const [completionItems, setCompletionItems] = createSignal<CompletionItem[]>([]);
  const [historyEntries, setHistoryEntries] = createSignal<string[]>([]);
  const [selectedIndex, setSelectedIndex] = createSignal<number | null>(null);
  let input: InputRenderable | undefined;

  const suggestions = createMemo<AutocompleteListItem[]>(() => {
    if (text().trim().length === 0) {
      return historyEntries().map((entry) => ({
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
  flow: AutocompleteFlow;
  focused: boolean;
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
        borderStyle="single"
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

function completionKindLabel(kind: CompletionItem["kind"]): string {
  switch (kind) {
    case "function": return "fn";
    case "bookmark": return "bm";
    case "tag": return "tg";
    case "alias": return "al";
  }
}