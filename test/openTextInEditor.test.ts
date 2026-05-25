import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openTextInEditor } from "../src/ui/openTextInEditor.ts";

test("openTextInEditor writes the text to a temp file and invokes $EDITOR on it", async () => {
  const interactiveCalls: Array<{ cwd: string; command: readonly string[]; fileContents: string }> = [];

  await openTextInEditor({
    text: "hello\nworld",
    runInteractive: async (cwd, command) => {
      const filePath = command.at(-1)!;
      const fileContents = await readFile(filePath, "utf8");
      interactiveCalls.push({ cwd, command, fileContents });
    },
    env: { EDITOR: "fake-editor" },
  });

  expect(interactiveCalls).toHaveLength(1);
  const call = interactiveCalls[0]!;
  expect(call.command[0]).toBe("fake-editor");
  expect(call.command.at(-1)).toContain(join(tmpdir(), "jif-edit-"));
  expect(call.command.at(-1)!.endsWith("notification.txt")).toBe(true);
  expect(call.cwd).toBe(call.command.at(-1)!.slice(0, -"/notification.txt".length));
  expect(call.fileContents).toBe("hello\nworld");
});

test("openTextInEditor splits multi-word editor commands into argv", async () => {
  const interactiveCalls: Array<{ command: readonly string[] }> = [];

  await openTextInEditor({
    text: "x",
    runInteractive: async (_cwd, command) => {
      interactiveCalls.push({ command });
    },
    env: { EDITOR: "code --wait" },
  });

  const command = interactiveCalls[0]!.command;
  expect(command[0]).toBe("code");
  expect(command[1]).toBe("--wait");
  expect(command).toHaveLength(3);
});

test("openTextInEditor falls back to vi when no env var is set", async () => {
  const interactiveCalls: Array<{ command: readonly string[] }> = [];

  await openTextInEditor({
    text: "x",
    runInteractive: async (_cwd, command) => {
      interactiveCalls.push({ command });
    },
    env: {},
  });

  expect(interactiveCalls[0]!.command[0]).toBe("vi");
});

test("openTextInEditor cleans up the temp directory after the editor exits", async () => {
  let capturedDir: string | null = null;

  await openTextInEditor({
    text: "x",
    runInteractive: async (cwd) => {
      capturedDir = cwd;
    },
    env: { EDITOR: "fake-editor" },
  });

  expect(capturedDir).not.toBeNull();
  await expect(readFile(join(capturedDir!, "notification.txt"))).rejects.toThrow();
});

test("openTextInEditor cleans up even if the editor invocation throws", async () => {
  let capturedDir: string | null = null;

  await expect(
    openTextInEditor({
      text: "x",
      runInteractive: async (cwd) => {
        capturedDir = cwd;
        throw new Error("editor failed");
      },
      env: { EDITOR: "fake-editor" },
    }),
  ).rejects.toThrow("editor failed");

  expect(capturedDir).not.toBeNull();
  await expect(readFile(join(capturedDir!, "notification.txt"))).rejects.toThrow();
});
