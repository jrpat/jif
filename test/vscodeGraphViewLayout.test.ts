import { expect, test } from "bun:test";
import { GRAPH_VIEW_TERMINAL_LEFT_PADDING_CH } from "../ext/vscode/src/graphViewLayout.ts";

test("graph view terminal left padding is one character", () => {
  expect(GRAPH_VIEW_TERMINAL_LEFT_PADDING_CH).toBe(1);
});