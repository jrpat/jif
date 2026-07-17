// Source-mode Bun resolves JSX settings from its launch directory. Load the
// application before changing cwd so this helper exercises the implicit-cwd
// startup path the same way the compiled jif binary does.
import "../../src/app.ts";
import { main } from "../../src/index.ts";

const [cwd, ...args] = process.argv.slice(2);
if (!cwd) {
  throw new Error("runJifFromCwd requires a cwd");
}

process.chdir(cwd);
void main(args).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
