import { expect, test } from "bun:test";
import { startInitialRepositoryLoad } from "../src/ui/startup.ts";

test("startInitialRepositoryLoad awaits palette detection before refreshing", async () => {
  const events: string[] = [];

  const result = await startInitialRepositoryLoad({
    detectAndApplyPalette: async () => {
      events.push("palette.done");
    },
    loadWorkspaceRoot: async () => {
      events.push("workspace.load");
      return "/repo";
    },
    loadDefaultRevset: async () => {
      events.push("default-revset.load");
      return "all()";
    },
    loadSavedRevset: async (workspaceRoot) => {
      events.push(`saved-revset.load:${workspaceRoot}`);
      return "";
    },
    refreshRepository: async (revset) => {
      events.push(`refresh:${revset}`);
      return true;
    },
    setWorkspaceRoot: (workspaceRoot) => {
      events.push(`workspace.set:${workspaceRoot}`);
    },
    setRevsetQuery: (query) => {
      events.push(`revset.set:${query}`);
    },
  });

  expect(result).toEqual({
    workspaceRoot: "/repo",
    initialRevset: "all()",
  });
  // palette.done must appear before refresh — it's awaited in Promise.all
  const paletteIndex = events.indexOf("palette.done");
  const refreshIndex = events.indexOf("refresh:all()");
  expect(paletteIndex).toBeGreaterThanOrEqual(0);
  expect(refreshIndex).toBeGreaterThan(paletteIndex);
});

test("startInitialRepositoryLoad prefers saved revset over default revset", async () => {
  const result = await startInitialRepositoryLoad({
    detectAndApplyPalette: async () => {},
    loadWorkspaceRoot: async () => "/repo",
    loadDefaultRevset: async () => "default()",
    loadSavedRevset: async () => "mine()",
    refreshRepository: async (revset) => revset === "mine()",
    setWorkspaceRoot: () => {},
    setRevsetQuery: () => {},
  });

  expect(result).toEqual({
    workspaceRoot: "/repo",
    initialRevset: "mine()",
  });
});