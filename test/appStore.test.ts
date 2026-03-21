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
