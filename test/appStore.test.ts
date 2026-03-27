import { expect, test } from "bun:test";
import { createAppStore } from "../src/state/appStore.ts";

test("AppStore keeps all app state in one reactive store", () => {
  const store = createAppStore("/tmp/repo");

  store.actions.focusCommandBar();
  store.actions.setCommandBarText("log");

  expect(store.state.focusMode).toBe("command");
  expect(store.state.commandBar.text).toBe("log");

  store.dispose();
});

test("AppStore seeds condensed layout from config options", () => {
  const store = createAppStore("/tmp/repo", { condensedLayout: true });

  expect(store.state.condensedLayout).toBeTrue();

  store.actions.toggleCondensedLayout();
  expect(store.state.condensedLayout).toBeFalse();

  store.dispose();
});

test("AppStore exposes shortcut panel actions", () => {
  const store = createAppStore("/tmp/repo");

  store.actions.openShortcutPanel();
  expect(store.state.shortcutPanelExpanded).toBeTrue();

  store.actions.toggleShortcutPanel();
  expect(store.state.shortcutPanelExpanded).toBeFalse();

  store.dispose();
});
