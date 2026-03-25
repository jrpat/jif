import { describe, expect, test } from "bun:test";
import {
  getAutocompleteAction,
  moveAutocompleteSelection,
  type AutocompleteFlow,
} from "../src/ui/autocomplete.ts";

describe("moveAutocompleteSelection", () => {
  test("next selects the first item when nothing is selected", () => {
    expect(moveAutocompleteSelection(null, 3, "next")).toBe(0);
  });

  test("previous selects the last item when nothing is selected", () => {
    expect(moveAutocompleteSelection(null, 3, "previous")).toBe(2);
  });

  test("next wraps around", () => {
    expect(moveAutocompleteSelection(2, 3, "next")).toBe(0);
  });

  test("previous wraps around", () => {
    expect(moveAutocompleteSelection(0, 3, "previous")).toBe(2);
  });

  test("returns null when there are no items", () => {
    expect(moveAutocompleteSelection(null, 0, "next")).toBeNull();
  });
});

describe("getAutocompleteAction", () => {
  function event(name: string, flow: AutocompleteFlow, options?: { ctrl?: boolean; shift?: boolean }) {
    return getAutocompleteAction(
      {
        name,
        ctrl: options?.ctrl ?? false,
        shift: options?.shift ?? false,
        meta: false,
        option: false,
      },
      flow,
    );
  }

  test("tab advances in top-to-bottom lists", () => {
    expect(event("tab", "top-to-bottom")).toBe("next");
  });

  test("tab advances in sort order for bottom-to-top lists", () => {
    expect(event("tab", "bottom-to-top")).toBe("next");
  });

  test("shift-tab moves backward", () => {
    expect(event("tab", "top-to-bottom", { shift: true })).toBe("previous");
    expect(event("tab", "bottom-to-top", { shift: true })).toBe("previous");
  });

  test("ctrl-j moves forward in top-to-bottom lists and backward in bottom-to-top lists", () => {
    expect(event("j", "top-to-bottom", { ctrl: true })).toBe("next");
    expect(event("j", "bottom-to-top", { ctrl: true })).toBe("previous");
  });

  test("ctrl-k moves backward in top-to-bottom lists and forward in bottom-to-top lists", () => {
    expect(event("k", "top-to-bottom", { ctrl: true })).toBe("previous");
    expect(event("k", "bottom-to-top", { ctrl: true })).toBe("next");
  });

  test("arrow keys follow visual direction", () => {
    expect(event("down", "top-to-bottom")).toBe("next");
    expect(event("up", "top-to-bottom")).toBe("previous");
    expect(event("down", "bottom-to-top")).toBe("previous");
    expect(event("up", "bottom-to-top")).toBe("next");
  });
});
