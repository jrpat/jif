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

test("AppStore seeds layout from config options and cycles through all layouts", () => {
  const store = createAppStore("/tmp/repo", { layout: "condensed" });

  expect(store.state.layout).toBe("condensed");

  store.actions.cycleLayout();
  expect(store.state.layout).toBe("super-condensed");

  store.actions.cycleLayout();
  expect(store.state.layout).toBe("expanded");

  store.actions.cycleLayout();
  expect(store.state.layout).toBe("condensed");

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
