import { expect, test } from "bun:test";
import {
  resolveJifRestartArgv,
  restartCurrentJif,
} from "../src/restart.ts";

test("resolveJifRestartArgv reruns the source entrypoint with Bun", () => {
  expect(resolveJifRestartArgv({
    execPath: "/opt/bun/bin/bun",
    main: "/src/jif/index.ts",
    moduleUrl: "file:///src/jif/src/restart.ts",
  })).toEqual(["/opt/bun/bin/bun", "/src/jif/index.ts"]);
});

test("resolveJifRestartArgv reruns the standalone executable directly", () => {
  expect(resolveJifRestartArgv({
    execPath: "/usr/local/bin/jif",
    main: "/$bunfs/root/index.js",
    moduleUrl: "file:///$bunfs/root/src/restart.js",
  })).toEqual(["/usr/local/bin/jif"]);
});

test("restartCurrentJif restores the terminal before replacing the process image", () => {
  const events: string[] = [];
  const sentinel = new Error("execv replaced process");

  expect(() =>
    restartCurrentJif({
      destroy: () => events.push("destroy"),
      execPath: "/usr/local/bin/jif",
      main: "/$bunfs/root/index.js",
      moduleUrl: "file:///$bunfs/root/src/restart.js",
      execv: (file, argv) => {
        events.push(`execv:${file}:${argv.join(" ")}`);
        throw sentinel;
      },
    })
  ).toThrow(sentinel);

  expect(events).toEqual([
    "destroy",
    "execv:/usr/local/bin/jif:/usr/local/bin/jif",
  ]);
});
