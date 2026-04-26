import { TextAttributes } from "@opentui/core";
import { For, Show, createEffect, createMemo, createSignal, onMount } from "solid-js";
import { useKeyboard } from "@opentui/solid";
import { matchHistoryEntries } from "../history/store.ts";
import type { JjClient } from "../jj/client.ts";
import { buildCompletionItems, extractLastToken, matchCompletions, type CompletionItem } from "../revset/completions.ts";
import type { AppStore } from "../state/appStore.ts";
import type { CommandSegment } from "../state/store.ts";
import type { ResolvedAppConfig } from "../config/schema.ts";
import { AutocompleteList, type AutocompleteListItem } from "./AutocompleteList.tsx";
import {
  getAutocompleteAction,
  moveAutocompleteSelection,
  type AutocompleteFlow,
} from "./autocomplete.ts";

export function CommandPrompt(props: {
  store: AppStore;
  config: ResolvedAppConfig;
  workspaceRoot: string | null;
  loadHistory: (workspaceRoot: string) => Promise<string[]>;
  commandText: string;
  onSubmit: (value: string) => void;
  onHeightChange?: (height: number) => void;
}) {
  const { store, config } = props;
  const colors = config.colorScheme.semanticColors;
  const flow: AutocompleteFlow = "bottom-to-top";
  const [historyEntries, setHistoryEntries] = createSignal<string[]>([]);
  const [selectedIndex, setSelectedIndex] = createSignal<number | null>(null);

  createEffect(() => {
    const workspaceRoot = props.workspaceRoot;

    if (!workspaceRoot) {
      setHistoryEntries([]);
      setSelectedIndex(null);
      return;
    }

    void props.loadHistory(workspaceRoot).then(setHistoryEntries);
  });

  createEffect(() => {
    props.commandText;
    setSelectedIndex(null);
  });

  const filteredHistory = createMemo(() => matchHistoryEntries(props.commandText, historyEntries()));

  const autocompleteItems = createMemo<AutocompleteListItem[]>(() =>
    filteredHistory().map((entry) => ({
      id: entry,
      text: entry,
    }))
  );

  useKeyboard((event) => {
    if (event.eventType === "release") {
      return;
    }

    const action = getAutocompleteAction(event, flow);
    if (action !== null) {
      event.preventDefault();
      setSelectedIndex((currentIndex) =>
        moveAutocompleteSelection(currentIndex, filteredHistory().length, action)
      );
      return;
    }

    if (event.name !== "return") {
      return;
    }

    const index = selectedIndex();
    if (index === null) {
      return;
    }

    const entry = filteredHistory()[index];
    if (!entry) {
      return;
    }

    event.preventDefault();
    store.actions.setCommandBarText(entry);
    setSelectedIndex(null);
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
      <box width={3} flexDirection="row" flexShrink={0}>
        <text fg={colors.textPrimary}>jj </text>
      </box>
      <input
        ref={(el: any) => el.editorView.setScrollMargin(0)}
        flexGrow={1}
        value={props.commandText}
        placeholder="subcommand"
        focused
        textColor={colors.textPrimary}
        focusedTextColor={colors.textPrimary}
        placeholderColor={colors.textQuaternary}
        cursorColor={colors.chromeBorderFocus}
        onInput={(value) => {
          store.actions.setCommandBarText(value);
        }}
        onSubmit={props.onSubmit as any}
      />
    </PromptShell>
  );
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
              fg={segment.style === "selected"
                ? colors.rowSelectedAccent
                : segment.style === "target"
                  ? colors.chromeBorderFocus
                  : segment.style === "placeholder"
                    ? colors.chromeBorderFocus
                    : colors.textPrimary}
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
        flexGrow={1}
        value={props.searchQuery}
        placeholder="search"
        focused={props.focused}
        textColor={colors.textPrimary}
        focusedTextColor={colors.textPrimary}
        placeholderColor={colors.textQuaternary}
        cursorColor={colors.chromeBorderFocus}
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

  const applySuggestion = (item: AutocompleteListItem) => {
    if (item.tag === "hs") {
      setText(item.text);
      setSelectedIndex(null);
      return;
    }

    const completion = completionItems().find((candidate) => candidate.name === item.text);
    if (!completion) {
      return;
    }

    const current = text();
    const { start } = extractLastToken(current);
    let nextValue = completion.name;
    if (completion.kind === "function") {
      nextValue += completion.hasParameters ? "(" : "()";
    }
    setText(current.slice(0, start) + nextValue);
    setSelectedIndex(null);
  };

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
      const idx = selectedIndex();
      const items = suggestions();
      if (idx !== null && idx < items.length) {
        applySuggestion(items[idx]!);
      } else {
        void props.onApply(text());
      }
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
        flexGrow={1}
        value={text()}
        focused
        textColor={colors.textPrimary}
        focusedTextColor={colors.textPrimary}
        cursorColor={colors.chromeBorderFocus}
        onInput={(value) => {
          setText(value);
          setSelectedIndex(null);
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

function completionKindLabel(kind: CompletionItem["kind"]): string {
  switch (kind) {
    case "function": return "fn";
    case "bookmark": return "bm";
    case "tag": return "tg";
    case "alias": return "al";
  }
}