import { expect, test } from "bun:test";
import { GRAPH_VIEW_TERMINAL_LEFT_PADDING_CH } from "../ext/vscode/src/graphViewLayout.ts";

test("graph view terminal left padding is 0.875ch", () => {
  expect(GRAPH_VIEW_TERMINAL_LEFT_PADDING_CH).toBe(0.875);
});
