export type SuspensibleRenderer = Readonly<{
  suspend(): void;
  resume(): void;
}>;

type SignalName = "SIGCONT" | "SIGTSTP";

type ProcessLike = Readonly<{
  pid: number;
  once(event: "SIGCONT", listener: () => void): void;
  off(event: "SIGCONT", listener: () => void): void;
  kill(pid: number, signal: "SIGTSTP"): void;
}>;

type ReleaseKeepAlive = () => void;
type CreateKeepAlive = () => ReleaseKeepAlive;
type DeferRelease = (callback: () => void) => void;

function createSuspendKeepAlive(): ReleaseKeepAlive {
  // Keep Bun alive until resume has restored renderer-driven handles.
  const handle = globalThis.setInterval(() => {}, 0x7fffffff);
  return () => {
    globalThis.clearInterval(handle);
  };
}

export function suspendProcessToShell(args: Readonly<{
  renderer: SuspensibleRenderer;
  processRef?: ProcessLike;
  createKeepAlive?: CreateKeepAlive;
  deferRelease?: DeferRelease;
}>): void {
  const processRef = args.processRef ?? process;
  const releaseKeepAlive = (args.createKeepAlive ?? createSuspendKeepAlive)();
  const deferRelease = args.deferRelease ?? globalThis.setImmediate;
  const resumeRenderer = () => {
    try {
      args.renderer.resume();
      deferRelease(() => {
        releaseKeepAlive();
      });
    } catch (error) {
      releaseKeepAlive();
      throw error;
    }
  };

  args.renderer.suspend();
  processRef.once("SIGCONT", resumeRenderer);

  try {
    processRef.kill(processRef.pid, "SIGTSTP");
  } catch (error) {
    processRef.off("SIGCONT", resumeRenderer);
    try {
      args.renderer.resume();
    } finally {
      releaseKeepAlive();
    }
    throw error;
  }
}