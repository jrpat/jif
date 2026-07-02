import { expect, test } from "bun:test";
import {
  configureOpenTUITreeSitterWorker,
  isBunStandaloneExecutableModuleUrl,
  opentuiEmbeddedTreeSitterWorkerPath,
} from "../src/opentuiTreeSitterWorker.ts";

test("isBunStandaloneExecutableModuleUrl detects Bun's embedded filesystem", () => {
  expect(isBunStandaloneExecutableModuleUrl("file:///$bunfs/root/jif")).toBeTrue();
  expect(isBunStandaloneExecutableModuleUrl("file:///tmp/jif/src/index.ts")).toBeFalse();
});

test("configureOpenTUITreeSitterWorker points OpenTUI at the embedded parser worker in standalone binaries", () => {
  const env: { OTUI_TREE_SITTER_WORKER_PATH?: string } = {};

  expect(configureOpenTUITreeSitterWorker({
    moduleUrl: "file:///$bunfs/root/jif",
    env,
  })).toBeTrue();
  expect(env.OTUI_TREE_SITTER_WORKER_PATH).toBe(opentuiEmbeddedTreeSitterWorkerPath);
});

test("configureOpenTUITreeSitterWorker leaves source-mode execution on OpenTUI defaults", () => {
  const env: { OTUI_TREE_SITTER_WORKER_PATH?: string } = {};

  expect(configureOpenTUITreeSitterWorker({
    moduleUrl: "file:///Users/me/src/jif/src/index.ts",
    env,
  })).toBeFalse();
  expect(env.OTUI_TREE_SITTER_WORKER_PATH).toBeUndefined();
});

test("configureOpenTUITreeSitterWorker preserves explicit worker overrides", () => {
  const env = { OTUI_TREE_SITTER_WORKER_PATH: "file:///custom/parser.worker.js" };

  expect(configureOpenTUITreeSitterWorker({
    env,
    moduleUrl: "file:///$bunfs/root/jif",
  })).toBeFalse();
  expect(env.OTUI_TREE_SITTER_WORKER_PATH).toBe("file:///custom/parser.worker.js");
});
