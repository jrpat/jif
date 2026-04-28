import { expect, test } from "bun:test";
import { suspendProcessToShell } from "../src/ui/suspend.ts";

test("suspendProcessToShell keeps the process alive until resume is reattached", () => {
  const events: string[] = [];
  const deferred: Array<() => void> = [];
  let resumeFromSignal: (() => void) | undefined;

  suspendProcessToShell({
    renderer: {
      suspend() {
        events.push("renderer.suspend");
      },
      resume() {
        events.push("renderer.resume");
      },
    },
    processRef: {
      pid: 42,
      once(event, listener) {
        events.push(`process.once:${event}`);
        resumeFromSignal = listener;
      },
      off(event) {
        events.push(`process.off:${event}`);
      },
      kill(pid, signal) {
        events.push(`process.kill:${pid}:${signal}`);
      },
    },
    createKeepAlive: () => {
      events.push("keepalive.start");
      return () => {
        events.push("keepalive.stop");
      };
    },
    deferRelease: (callback) => {
      events.push("defer.release");
      deferred.push(callback);
    },
  });

  expect(events).toEqual([
    "keepalive.start",
    "renderer.suspend",
    "process.once:SIGCONT",
    "process.kill:42:SIGTSTP",
  ]);

  resumeFromSignal?.();

  expect(events).toEqual([
    "keepalive.start",
    "renderer.suspend",
    "process.once:SIGCONT",
    "process.kill:42:SIGTSTP",
    "renderer.resume",
    "defer.release",
  ]);

  deferred[0]?.();

  expect(events).toEqual([
    "keepalive.start",
    "renderer.suspend",
    "process.once:SIGCONT",
    "process.kill:42:SIGTSTP",
    "renderer.resume",
    "defer.release",
    "keepalive.stop",
  ]);
});

test("suspendProcessToShell resumes immediately if SIGTSTP fails", () => {
  const events: string[] = [];
  const failure = new Error("stop failed");

  expect(() => {
    suspendProcessToShell({
      renderer: {
        suspend() {
          events.push("renderer.suspend");
        },
        resume() {
          events.push("renderer.resume");
        },
      },
      processRef: {
        pid: 42,
        once(event) {
          events.push(`process.once:${event}`);
        },
        off(event) {
          events.push(`process.off:${event}`);
        },
        kill() {
          events.push("process.kill");
          throw failure;
        },
      },
      createKeepAlive: () => {
        events.push("keepalive.start");
        return () => {
          events.push("keepalive.stop");
        };
      },
    });
  }).toThrow(failure);

  expect(events).toEqual([
    "keepalive.start",
    "renderer.suspend",
    "process.once:SIGCONT",
    "process.kill",
    "process.off:SIGCONT",
    "renderer.resume",
    "keepalive.stop",
  ]);
});