import { expect, test } from "bun:test";
import { JifPtyIpc } from "../ext/vscode/src/ptyIpc.ts";

const wrap = (json: string) => `\x1b_jif-vscode:${json}\x1b\\`;

test("JifPtyIpc forwards plain output unchanged", () => {
  const messages: unknown[] = [];
  const ipc = new JifPtyIpc((msg) => messages.push(msg));

  expect(ipc.process("hello world")).toBe("hello world");
  expect(messages).toEqual([]);
});

test("JifPtyIpc extracts a complete sequence and strips it from forwarded data", () => {
  const messages: unknown[] = [];
  const ipc = new JifPtyIpc((msg) => messages.push(msg));

  const payload = JSON.stringify({ kind: "diff-revision", revisionId: "abc" });
  const chunk = `before${wrap(payload)}after`;

  expect(ipc.process(chunk)).toBe("beforeafter");
  expect(messages).toEqual([{ kind: "diff-revision", revisionId: "abc" }]);
});

test("JifPtyIpc handles multiple sequences in a single chunk", () => {
  const messages: unknown[] = [];
  const ipc = new JifPtyIpc((msg) => messages.push(msg));

  const a = wrap(JSON.stringify({ kind: "a" }));
  const b = wrap(JSON.stringify({ kind: "b" }));
  expect(ipc.process(`${a}between${b}tail`)).toBe("betweentail");
  expect(messages).toEqual([{ kind: "a" }, { kind: "b" }]);
});

test("JifPtyIpc buffers a sequence split across chunks at the body", () => {
  const messages: unknown[] = [];
  const ipc = new JifPtyIpc((msg) => messages.push(msg));

  const payload = JSON.stringify({ kind: "diff-file", path: "src/app.ts" });
  const full = `pre${wrap(payload)}post`;
  const splitAt = full.indexOf(":") + 5;

  const first = ipc.process(full.slice(0, splitAt));
  const second = ipc.process(full.slice(splitAt));

  expect(first + second).toBe("prepost");
  expect(messages).toEqual([{ kind: "diff-file", path: "src/app.ts" }]);
});

test("JifPtyIpc buffers a sequence split inside the start marker", () => {
  const messages: unknown[] = [];
  const ipc = new JifPtyIpc((msg) => messages.push(msg));

  const payload = JSON.stringify({ kind: "diff-revision", revisionId: "z" });
  const full = `head${wrap(payload)}tail`;
  // Split inside the literal "\x1b_jif-vscode:" prefix.
  const splitAt = full.indexOf("\x1b_jif-vscode:") + 5;

  const first = ipc.process(full.slice(0, splitAt));
  const second = ipc.process(full.slice(splitAt));

  expect(first + second).toBe("headtail");
  expect(messages).toEqual([{ kind: "diff-revision", revisionId: "z" }]);
});

test("JifPtyIpc swallows malformed JSON without breaking the stream", () => {
  const messages: unknown[] = [];
  const ipc = new JifPtyIpc((msg) => messages.push(msg));

  const chunk = `pre${wrap("not json")}post`;
  expect(ipc.process(chunk)).toBe("prepost");
  expect(messages).toEqual([]);
});

test("JifPtyIpc preserves data without our marker even if it contains other ESC sequences", () => {
  const messages: unknown[] = [];
  const ipc = new JifPtyIpc((msg) => messages.push(msg));

  // OSC sequence and CSI cursor move — neither should be consumed.
  const chunk = "\x1b]0;title\x07\x1b[2J\x1b[H";
  expect(ipc.process(chunk)).toBe(chunk);
  expect(messages).toEqual([]);
});
