import { expect, test } from "bun:test";
import { RGBA, TextAttributes } from "@opentui/core";
import {
  buildNotificationStyledText,
  getNotificationBodyText,
  getNotificationCommandLineCount,
} from "../src/ui/notificationContent.ts";

test("command output prefixes the command without adding layout spacing", () => {
  expect(getNotificationBodyText("Changed 1 files", {
    commandText: "restore foo.ts",
    executor: "jj",
    interactive: false,
  })).toBe(
    "❯ jj restore foo.ts\nChanged 1 files",
  );
  expect(getNotificationBodyText("ordinary message")).toBe("ordinary message");
  expect(getNotificationCommandLineCount({
    commandText: "printf foo\nprintf bar",
    executor: "shell",
    interactive: false,
  })).toBe(2);
  expect(getNotificationCommandLineCount()).toBe(0);
});

test("command output styles the command bold in the status color", () => {
  const result = buildNotificationStyledText({
    text: "Changed 1 files",
    command: {
      commandText: "restore foo.ts",
      executor: "jj",
      interactive: false,
    },
    commandColor: "#12ab34",
  });

  expect(result.chunks.map((chunk) => chunk.text).join("")).toBe(
    "❯ jj restore foo.ts\nChanged 1 files",
  );
  const commandChunk = result.chunks.find((chunk) => chunk.text === "❯ jj restore foo.ts");
  expect(commandChunk).toBeDefined();
  expect((commandChunk!.attributes ?? 0) & TextAttributes.BOLD).not.toBe(0);
  expect(commandChunk!.fg?.toInts()).toEqual(RGBA.fromHex("#12ab34").toInts());
});

test("a presentation title replaces the command text without hiding the output", () => {
  const command = {
    commandText: "printf %s main | pbcopy",
    executor: "shell" as const,
    interactive: false,
  };

  expect(getNotificationBodyText("main", command, "Copied to clipboard")).toBe(
    "Copied to clipboard\nmain",
  );

  const result = buildNotificationStyledText({
    text: "main",
    command,
    title: "Copied to clipboard",
    commandColor: "#12ab34",
  });
  expect(result.chunks.map((chunk) => chunk.text).join("")).toBe(
    "Copied to clipboard\nmain",
  );
});
