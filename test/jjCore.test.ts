import { expect, test } from "bun:test";
import { buildChangeLabel, getTrackedParentChain } from "../packages/jj-core/src/index.ts";

test("getTrackedParentChain returns the fixed first-parent chain", () => {
  expect(getTrackedParentChain()).toEqual([
    {
      id: "parent-1",
      label: "@-",
      revset: "@-",
      baseRevset: "@--",
    },
    {
      id: "parent-2",
      label: "@--",
      revset: "@--",
      baseRevset: "first_parent(@, 3)",
    },
  ]);
});

test("buildChangeLabel includes the revision syntax and description", () => {
  expect(buildChangeLabel("@-", {
    description: "Fix the source control view",
    isConflict: false,
  })).toBe("@- • Fix the source control view");
});

test("buildChangeLabel appends conflict marker when needed", () => {
  expect(buildChangeLabel("@--", {
    description: "",
    isConflict: true,
  })).toBe("@-- (conflict)");
});