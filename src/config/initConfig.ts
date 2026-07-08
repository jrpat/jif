import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  CONFIG_CANDIDATES,
  projectConfigDir,
  resolveConfigFilePath,
  resolveUserConfigDir,
  resolveWorkspaceRoot,
} from "./loadConfig.ts";
import { DEFAULT_PREVIEW_PANE_FILL_OPACITY } from "./schema.ts";

const GENERATED_TYPES_FILENAME = "jif.d.ts";
const DEFAULT_CONFIG_FILENAME = "config.ts";

type SeedConfigResult = Readonly<{
  configPath: string;
  createdConfig: boolean;
}> & ConfigTypesResult;

type ConfigTypesResult = Readonly<{
  configDir: string;
  typesPath: string;
  createdTypes: boolean;
  updatedTypes: boolean;
}>;

export type InitUserConfigResult = SeedConfigResult;

export type InitProjectConfigResult = SeedConfigResult & Readonly<{
  workspaceRoot: string;
}>;

export async function initUserConfig(options: Readonly<{
  configDir?: string;
}> = {}): Promise<InitUserConfigResult> {
  return seedConfig(options.configDir ?? resolveUserConfigDir());
}

export async function refreshUserConfigTypes(options: Readonly<{
  configDir?: string;
  configPath?: string;
}> = {}): Promise<ConfigTypesResult> {
  const configDir = options.configDir
    ?? (options.configPath !== undefined
      ? dirname(resolveConfigFilePath(options.configPath))
      : resolveUserConfigDir());
  return writeGeneratedConfigTypes(configDir);
}

export async function initProjectConfig(options: Readonly<{
  startDir: string;
}>): Promise<InitProjectConfigResult> {
  const workspaceRoot = await resolveWorkspaceRoot(options.startDir);
  if (workspaceRoot === null) {
    throw new Error(
      `Not inside a JJ workspace: ${options.startDir}`,
    );
  }

  const seeded = await seedConfig(projectConfigDir(workspaceRoot));
  return { ...seeded, workspaceRoot };
}

async function seedConfig(configDir: string): Promise<SeedConfigResult> {
  await mkdir(configDir, { recursive: true });

  const existingConfigPath = await findExistingConfigPath(configDir);
  const configPath = existingConfigPath ?? join(configDir, DEFAULT_CONFIG_FILENAME);
  const createdConfig = existingConfigPath === null
    ? await writeIfMissing(configPath, renderPlaceholderConfig())
    : false;
  const typesResult = await writeGeneratedConfigTypes(configDir);

  return {
    ...typesResult,
    configPath,
    createdConfig,
  };
}

async function writeGeneratedConfigTypes(configDir: string): Promise<ConfigTypesResult> {
  const typesPath = join(configDir, GENERATED_TYPES_FILENAME);

  await mkdir(configDir, { recursive: true });

  const renderedTypes = renderConfigTypes();
  const existingTypes = await readOptionalText(typesPath);
  const createdTypes = existingTypes === null;
  const updatedTypes = existingTypes !== null && existingTypes !== renderedTypes;
  await writeFile(typesPath, renderedTypes, { encoding: "utf8" });

  return {
    configDir,
    typesPath,
    createdTypes,
    updatedTypes,
  };
}

async function findExistingConfigPath(configDir: string): Promise<string | null> {
  for (const candidate of CONFIG_CANDIDATES) {
    const path = join(configDir, candidate);
    if (await fileExists(path)) {
      return path;
    }
  }

  return null;
}

async function writeIfMissing(path: string, content: string): Promise<boolean> {
  try {
    await writeFile(path, content, { encoding: "utf8", flag: "wx" });
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      return false;
    }
    throw error;
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readOptionalText(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function renderPlaceholderConfig(): string {
  return `/// <reference path="./${GENERATED_TYPES_FILENAME}" />

export default {
  colorScheme: {
    colors: {
      // chromeBorderFocus: "#00cdcd",
      // previewPaneFill: { source: "foreground", opacity: ${DEFAULT_PREVIEW_PANE_FILL_OPACITY} },
    },
  },
  log: {
    // scrollMargin: 1,
    // revisionIdAdditionalChars: 0,
  },
  scroll: {
    // step: 2,
    // acceleration: true,
  },
  refresh: {
    // intervalMs: 0,
    // watch: true,
  },
  commands: {
    // shortFlags: true,
    // layout: "normal",
  },
  notifications: {
    // historyLimit: 50,
  },
  preview: {
    // wordWrap: false,
  },
  keymap: {
    normal: {
      // "ctrl-g": {
      //   title: "Show focused revision",
      //   run: (cmd, app) => {
      //     if (!app.rev) return;
      //     // app.rev is the focused revision's jj argument (app.focusedRevision is the object).
      //     return cmd.jji(\`show -r \${app.rev}\`);
      //   },
      // },
    },
  },
} satisfies Jif.Config;
`;
}

function renderConfigTypes(): string {
  return `export {};

declare global {
namespace Jif {
  type AppLayout = "loose" | "normal" | "tight";
  type FocusMode = "revisions" | "files" | "op-log" | "evolog" | "inline-confirmation" | "command" | "revset" | "file-search" | "search" | "diff-viewer" | "notifications";
  type SearchScopeId = "revision-log" | "operation-log" | "evolog";
  type SearchMode = "search" | "fast-jump";
  type StatusLevel = "info" | "success" | "warning" | "error";
  type RevisionMarker = "working-copy" | "bookmark" | "plain" | "immutable" | "elided";
  type CommandGroup = "global" | "mode" | "cancel";

  type PaletteSource =
    | "foreground" | "background"
    | "black" | "red" | "green" | "yellow"
    | "blue" | "magenta" | "cyan" | "white"
    | "brightBlack" | "brightRed" | "brightGreen" | "brightYellow"
    | "brightBlue" | "brightMagenta" | "brightCyan" | "brightWhite";

  type PaletteColorDef = Readonly<{ source: PaletteSource; opacity: number }>;
  type SemanticColorOverride = string | PaletteColorDef;

  type SemanticColorKey =
    | "chromeFillOne" | "chromeFillTwo" | "chromeFillThree" | "chromeScrollbarThumb"
    | "chromeBorderIdle" | "chromeBorderFocus"
    | "promptSuggestionFocusedFill" | "previewPaneFill"
    | "rowFocusedFill" | "rowSelectedFill" | "rowSelectedAccent" | "rowAffectedFill"
    | "rowCommandTargetBorder" | "rowBorderIdle" | "rowBorderFocus" | "rowBorderSelected" | "rowBorderCommandTarget"
    | "graphWorkingCopy" | "graphPlain" | "graphImmutable" | "graphBookmark"
    | "bookmarkTagFill" | "bookmarkTagText" | "workspaceTagFill" | "workspaceTagText"
    | "conflictTagFill" | "conflictTagText"
    | "textPrimary" | "textSecondary" | "textTertiary" | "textQuaternary"
    | "revsetPrefix" | "fileFocusMarker" | "fileStatusAccent"
    | "diffFileName" | "diffAddedFill" | "diffRemovedFill" | "diffAddedSign" | "diffRemovedSign" | "diffLineNumber"
    | "statusInfo" | "statusSuccess" | "statusWarning" | "statusError"
    | "statusInfoFill" | "statusSuccessFill" | "statusWarningFill" | "statusErrorFill";

  type ChangedFile = Readonly<{
    path: string;
    status: string;
    hasConflict?: boolean;
  }>;

  type RevisionSummary = Readonly<{
    rowId: string;
    revisionId: string;
    parentRevisionIds?: readonly string[];
    changeIdPrefixLength: number;
    commitId: string;
    description: string;
    localTimestamp: string;
    bookmarks: readonly string[];
    workspaces: readonly string[];
    graphRows: readonly string[];
    isEmpty: boolean;
    hasConflict: boolean;
    marker: RevisionMarker;
    filesLoaded: boolean;
    files: readonly ChangedFile[];
  }>;

  type StatusMessage = Readonly<{
    id: string;
    text: string;
    level: StatusLevel;
    createdAt: number;
  }>;

  type EventLogEntry = Readonly<{
    id: string;
    text: string;
    level: StatusLevel;
    createdAt: number;
  }>;

  type FailedCommand = Readonly<{
    commandText: string;
    commandArgs: readonly string[];
    interactive: boolean;
    errorText: string;
    stderr: string;
  }>;

  type AppState = Readonly<{
    repoPath: string;
    revisions: readonly RevisionSummary[];
    focusMode: FocusMode;
    focusModeStack: readonly FocusMode[];
    inlineConfirmation?: unknown;
    shortcutPanelExpanded: boolean;
    focusedRevisionIndex: number;
    expandedRowId: string | null;
    focusedFileIndex: number;
    selectedRowIds: readonly string[];
    markedRowIds: readonly string[];
    selectedFilePaths: readonly string[];
    commandBar: Readonly<{ text: string; manual: boolean }>;
    commandDraft: unknown;
    lastFailedCommand: FailedCommand | null;
    statusMessages: readonly StatusMessage[];
    eventLog: readonly EventLogEntry[];
    notificationHistoryLimit: number;
    focusedNotificationIndex: number;
    expandedNotificationIds: readonly string[];
    loading: boolean;
    useShortFlags: boolean;
    layout: AppLayout;
    revsetQuery: string;
    revsetInputQuery: string | null;
    searchQuery: string;
    searchScope: SearchScopeId | null;
    searchStartIndex: number | null;
    searchIdOnly: boolean;
    searchMode: SearchMode;
    previewFullFile: boolean;
    /** Focused revision's jj argument, or "" when nothing is focused. e.g. \`edit \${app.rev}\`. */
    rev: string;
    /** Focused file's path, or "" when nothing is focused. e.g. \`diff \${app.file}\`. */
    file: string;
    /** Selected revisions' jj arguments, in selection order. e.g. \`abandon \${app.selectedRevs.join(" ")}\`. */
    selectedRevs: readonly string[];
    /** Focused revision object, or null. */
    focusedRevision: RevisionSummary | null;
    /** Focused changed file object, or null. */
    focusedFile: ChangedFile | null;
  }>;

  type JjCommandOptions = Readonly<{
    cwd?: string;
    focusWorkingCopyAfterRefresh?: boolean;
  }>;

  type ShellCommandOptions = JjCommandOptions;

  type InteractiveJjCommandOptions = Readonly<{
    cwd?: string;
  }>;

  type InteractiveShellCommandOptions = Readonly<{
    cwd?: string;
  }>;

  type UserCommandController = Readonly<{
    moveFocus: (delta: number) => void;
    moveFocusToParent: () => void;
    moveFocusToChild: () => void;
    moveFocusToNextDivergentSibling: () => void;
    moveFocusToWorkspace: (direction: 1 | -1) => void;
    moveFocusToBookmark: (direction: 1 | -1) => void;
    focusLogBottom: () => void;
    focusCurrentOperation: () => void;
    openFocusedRevision: () => void;
    closeFocusedRevision: () => void;
    quit: () => void;
    suspend: () => void;
    cancelOrBlur: () => void;
    confirm: () => void;
    focusCommandBar: () => void;
    focusShellCommandBar: () => void;
    forceLastCommand: () => void;
    startRebase: () => void;
    startSplit: () => void;
    startSquash: () => void;
    startInterdiff: () => void;
    startNewRevision: () => void;
    editRevision: () => void;
    toggleSelection: () => void;
    toggleFileSelection: () => void;
    selectAllFiles: () => void;
    restoreFiles: () => void;
    selectPreviousInlineConfirmationOption: () => void;
    selectNextInlineConfirmationOption: () => void;
    toggleShortFlags: () => void;
    cycleLayout: () => void;
    setRebaseSourceKind: (kind: "revisions" | "source" | "branch") => void;
    setRebaseTargetKind: (kind: "destination" | "insert-before" | "insert-after" | "insert-between") => void;
    toggleRebaseSkipEmptied: () => void;
    toggleSquashAnchor: () => void;
    toggleInterdiffSwap: () => void;
    togglePreviewWordWrap: () => void;
    togglePreviewFullFile: () => void;
    selectAbsorbDescendants: () => void;
    undo: () => void;
    redo: () => void;
    focusWorkingCopy: () => void;
    openRevsetInput: (initialQuery?: string) => void;
    openFileSearch: () => void;
    restrictRevsetToFocusedFile: () => void;
    toggleShortcutPanel: () => void;
    commit: () => void;
    describe: () => void;
    showRevisionDiff: () => void;
    showFileDiff: () => void;
    openSearch: () => void;
    openFastJump: () => void;
    nextSearchMatch: () => void;
    prevSearchMatch: () => void;
    reloadConfig: () => void;
    refreshRepository: () => void;
    startAbsorb: () => void;
    abandonRevision: () => void;
    openNotifications: () => void;
    expandNotification: () => void;
    collapseNotification: () => void;
    jj: (commandText: string, options?: JjCommandOptions) => Promise<void>;
    sh: (commandText: string, options?: ShellCommandOptions) => Promise<void>;
    jji: (commandText: string, options?: InteractiveJjCommandOptions) => Promise<void>;
    shi: (commandText: string, options?: InteractiveShellCommandOptions) => Promise<void>;
  }>;

  type UserAliasBinding = Readonly<{ command: string; canonical: false }>;

  type UserKeybindingCommand = Readonly<{
    id?: string;
    title: string;
    canonical?: false;
    canExecute?: (state: AppState) => boolean;
    run: (controller: UserCommandController, state: AppState) => void | Promise<void>;
    group?: CommandGroup;
  }>;

  type UserKeyBinding = string | UserAliasBinding | UserKeybindingCommand;

  type KeymapScope =
    | "_global"
    | "normal"
    | "files"
    | "op-log"
    | "evolog"
    | "inline-confirmation"
    | "rebase"
    | "restore"
    | "squash"
    | "interdiff"
    | "diff"
    | "absorb"
    | "command"
    | "revset"
    | "search"
    | "diff-viewer"
    | "notifications"
    | "extra";

  type UserKeyMap = Partial<Record<KeymapScope, Readonly<Record<string, UserKeyBinding>>>>;

  type Config = Readonly<{
    colorScheme?: Readonly<{
      colors?: Partial<Record<SemanticColorKey, SemanticColorOverride>>;
    }>;
    keymap?: UserKeyMap;
    log?: Readonly<{
      scrollMargin?: number;
      revisionIdAdditionalChars?: number;
    }>;
    scroll?: Readonly<{
      step?: number;
      acceleration?: boolean;
    }>;
    refresh?: Readonly<{
      intervalMs?: number;
      watch?: boolean;
    }>;
    commands?: Readonly<{
      shortFlags?: boolean;
      layout?: AppLayout;
    }>;
    notifications?: Readonly<{
      historyLimit?: number;
    }>;
    preview?: Readonly<{
      position?: "auto" | "right" | "below";
      showByDefault?: boolean;
      defaultWidthPercent?: number;
      resizeStepPercent?: number;
      minSizePercent?: number;
      maxSizePercent?: number;
      narrowWidth?: number;
      whenNarrow?: "below" | "hide";
      wordWrap?: boolean;
    }>;
  }>;
}
}
`;
}
