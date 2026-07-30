import { dlopen, ptr } from "bun:ffi";

type Execv = (file: string, argv: readonly string[]) => never;

export function resolveJifRestartArgv(args: Readonly<{
  execPath: string;
  main: string;
  moduleUrl: string;
}>): string[] {
  return args.moduleUrl.startsWith("file:///$bunfs/")
    ? [args.execPath]
    : [args.execPath, args.main];
}

export function restartCurrentJif(args: Readonly<{
  destroy: () => void;
  execPath?: string;
  main?: string;
  moduleUrl?: string;
  execv?: Execv;
}>): never {
  const execPath = args.execPath ?? process.execPath;
  const argv = resolveJifRestartArgv({
    execPath,
    main: args.main ?? Bun.main,
    moduleUrl: args.moduleUrl ?? import.meta.url,
  });

  args.destroy();
  return (args.execv ?? execvCurrentProcess)(execPath, argv);
}

export function execvCurrentProcess(
  file: string,
  argv: readonly string[],
  platform: NodeJS.Platform = process.platform,
): never {
  const libcPath = platform === "darwin"
    ? "/usr/lib/libSystem.B.dylib"
    : platform === "linux"
    ? "libc.so.6"
    : null;
  if (libcPath === null) {
    throw new Error(`Process restart is not supported on ${platform}`);
  }

  const strings = argv.map(toCString);
  const fileString = toCString(file);
  const pointers = new BigUint64Array(strings.length + 1);
  strings.forEach((value, index) => {
    pointers[index] = BigInt(ptr(value));
  });

  const libc = dlopen(libcPath, {
    execv: {
      args: ["ptr", "ptr"],
      returns: "i32",
    },
  });
  const result = libc.symbols.execv(ptr(fileString), ptr(pointers));
  libc.close();
  throw new Error(`Could not restart jif (execv returned ${result})`);
}

function toCString(value: string): Uint8Array {
  return new TextEncoder().encode(`${value}\0`);
}
