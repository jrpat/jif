export const opentuiEmbeddedTreeSitterWorkerPath = "file:///$bunfs/root/src/opentuiParserWorker.js";

type TreeSitterWorkerEnvironment = {
  OTUI_TREE_SITTER_WORKER_PATH?: string | undefined;
};

export function isBunStandaloneExecutableModuleUrl(moduleUrl: string): boolean {
  return moduleUrl.startsWith("file:///$bunfs/");
}

export function configureOpenTUITreeSitterWorker(options: {
  env?: TreeSitterWorkerEnvironment;
  moduleUrl?: string;
} = {}): boolean {
  const env = options.env ?? process.env;
  if (env.OTUI_TREE_SITTER_WORKER_PATH?.trim()) {
    return false;
  }

  if (!isBunStandaloneExecutableModuleUrl(options.moduleUrl ?? import.meta.url)) {
    return false;
  }

  env.OTUI_TREE_SITTER_WORKER_PATH = opentuiEmbeddedTreeSitterWorkerPath;
  return true;
}
