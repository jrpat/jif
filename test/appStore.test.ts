import { expect, test } from "bun:test";
import { createAppStore } from "../src/state/appStore.ts";

test("AppStore keeps all state in one reactive store and notifies on commit", () => {
  let commits = 0;
  const store = createAppStore("/tmp/repo", () => {
    commits += 1;
  });

  store.actions.focusCommandBar();
  store.actions.insertCommandText("log");

  expect(store.state.commandBar.focus).toBeTrue();
  expect(store.state.commandBar.text).toBe("log");
  expect(commits).toBe(2);

  store.dispose();
});
