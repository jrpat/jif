import { expect, test } from "bun:test";
import { createTestRenderer } from "@rezi-ui/core";
import { defaultAppConfig, resolveAppConfig } from "../src/config/index.ts";
import type { AppState } from "../src/domain/types.ts";
import { createInitialState } from "../src/state/store.ts";
import { renderApp } from "../src/ui/render.tsx";

test("renderApp shows command bar and revision identity", () => {
  const renderer = createTestRenderer({
    viewport: { cols: 120, rows: 40 },
  });
  const state: AppState = {
    ...createInitialState("/tmp/repo"),
    loading: false,
    revisions: [
      {
        changeId: "aaaaaaaa",
        commitId: "11111111",
        description: "build graph renderer",
        bookmarks: ["main"],
        workspaces: ["default"],
        graphHead: "@  ",
        graphTail: [],
        marker: "working-copy",
        files: [{ status: "M", path: "src/app.ts" }],
      },
    ],
  };

  const result = renderer.render(renderApp(state, resolveAppConfig(defaultAppConfig)));
  const text = result.toText();
  expect(text).toContain("command");
  expect(text).toContain("aaaaaaaa");
  expect(text).toContain("@");
});
