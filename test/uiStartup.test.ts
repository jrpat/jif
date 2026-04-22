import { expect, test } from "bun:test";
import { startInitialRepositoryLoad } from "../src/ui/startup.ts";

test("startInitialRepositoryLoad does not block repository refresh on palette detection", async () => {
  const events: string[] = [];
  let resolvePalette!: () => void;

  const paletteTask = new Promise<void>((resolve) => {
    resolvePalette = () => {
      events.push("palette.done");
      resolve();
    };
  });

  const resultPromise = startInitialRepositoryLoad({
    detectAndApplyPalette: async () => {
      events.push("palette.start");
      await paletteTask;
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

  const result = await resultPromise;

  expect(result).toEqual({
    workspaceRoot: "/repo",
    initialRevset: "all()",
  });
  expect(events).toEqual([
    "palette.start",
    "workspace.load",
    "default-revset.load",
    "workspace.set:/repo",
    "saved-revset.load:/repo",
    "revset.set:all()",
    "refresh:all()",
  ]);

  resolvePalette();
  await paletteTask;

  expect(events.at(-1)).toBe("palette.done");
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