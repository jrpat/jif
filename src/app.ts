import {
  type UiEvent,
} from "@rezi-ui/core";
import {
  ZR_KEY_BACKSPACE,
  ZR_KEY_DELETE,
  ZR_KEY_ENTER,
  ZR_KEY_ESCAPE,
  ZR_KEY_LEFT,
  ZR_KEY_RIGHT,
} from "@rezi-ui/core/keybindings";
import { createNodeApp } from "@rezi-ui/node";
import { createBindings } from "./commands/definitions.ts";
import type { AppState } from "./domain/types.ts";
import { JjClient } from "./jj/client.ts";
import {
  applyRepositoryData,
  backspaceCommandText,
  blurCommandBar,
  cancelCommandState,
  commandCanExecute,
  createInitialState,
  deleteCommandText,
  focusCommandBar,
  getDisplayedCommandText,
  getFocusedRevision,
  insertCommandText,
  moveCommandCursor,
  moveFocus,
  openFocusedRevision,
  pushEvent,
  setError,
  setLoading,
  setRevisionFiles,
  startRebaseCommand,
  toggleRebaseDescendants,
} from "./state/store.ts";
import { renderApp } from "./ui/render.ts";

export async function createJifApplication(repoPath: string) {
  const client = new JjClient(repoPath);
  let currentState: AppState = createInitialState(repoPath);

  const app = createNodeApp({
    initialState: currentState,
    config: {
      fpsCap: 30,
      themeTransitionFrames: 4,
      rootPadding: 0,
    },
  });

  const updateState = (updater: (state: AppState) => AppState) => {
    app.update((previousState) => {
      currentState = updater(previousState as AppState);
      return currentState;
    });
  };

  const controller = {
    moveFocus(delta: number) {
      updateState((state) => moveFocus(state, delta));
    },
    openFocusedRevision() {
      const revision = getFocusedRevision(currentState);
      if (!revision) {
        return;
      }

      updateState((state) => openFocusedRevision(state));
      if (revision.files.length === 0) {
        void (async () => {
          try {
            const files = await client.loadChangedFiles(revision.changeId);
            updateState((state) => setRevisionFiles(state, revision.changeId, files));
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            updateState((state) => pushEvent(state, message, "error"));
          }
        })();
      }
    },
    closeFocusedRevision() {
      updateState((state) => ({
        ...state,
        expandedRevisionId:
          getFocusedRevision(state)?.changeId === state.expandedRevisionId
            ? null
            : state.expandedRevisionId,
        focusedFileIndex: 0,
      }));
    },
    cancelOrBlur() {
      updateState((state) => {
        if (state.commandBar.focus) {
          return cancelCommandState(state);
        }
        if (state.commandDraft) {
          return cancelCommandState(state);
        }
        return blurCommandBar(state);
      });
    },
    confirm() {
      void executeCurrentCommand();
    },
    startRebase() {
      const revision = getFocusedRevision(currentState);
      if (!revision) {
        return;
      }

      void (async () => {
        try {
          const descendants = await client.resolveDescendants(revision.changeId);
          updateState((state) => startRebaseCommand(state, descendants));
          updateState((state) =>
            pushEvent(state, `Composing rebase for ${revision.changeId}`, "info"),
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          updateState((state) => pushEvent(state, message, "error"));
        }
      })();
    },
    toggleRebaseDescendants() {
      const draft = currentState.commandDraft;
      if (draft?.kind !== "rebase") {
        return;
      }

      void (async () => {
        try {
          const descendants = await client.resolveDescendants(draft.sourceRevisionId);
          updateState((state) => toggleRebaseDescendants(state, descendants));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          updateState((state) => pushEvent(state, message, "error"));
        }
      })();
    },
  };

  app.view((state) => {
    currentState = state as AppState;
    return renderApp(currentState);
  });

  app.keys(createBindings(controller));
  app.onEvent((event) => {
    handleEvent(event, updateState, currentState);
  });

  async function refreshRepository() {
    updateState((state) => setLoading(state, true));
    try {
      await client.verifyRepository();
      const repositoryData = await client.loadRepository();
      updateState((state) => applyRepositoryData(state, repositoryData));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      updateState((state) => setError(state, message));
      updateState((state) => pushEvent(state, message, "error"));
    }
  }

  async function executeCurrentCommand() {
    const state = currentState;
    if (!commandCanExecute(state)) {
      return;
    }

    const commandText = getDisplayedCommandText(state).trim();
    if (commandText.length === 0) {
      return;
    }

    updateState((previousState) => setLoading(previousState, true));

    try {
      const resultMessage = await client.executeCommand(commandText);
      updateState((previousState) => cancelCommandState(previousState));
      updateState((previousState) =>
        pushEvent(previousState, resultMessage, "success"),
      );
      await refreshRepository();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      updateState((previousState) => pushEvent(previousState, message, "error"));
      updateState((previousState) => setLoading(previousState, false));
    }
  }

  return {
    app,
    refreshRepository,
  };
}

function handleEvent(
  event: UiEvent,
  updateState: (updater: (state: AppState) => AppState) => void,
  currentState: AppState,
) {
  if (event.kind !== "engine") {
    return;
  }

  if (event.event.kind === "text") {
    const text = String.fromCodePoint(event.event.codepoint);
    if (!currentState.commandBar.focus && text === ":") {
      updateState((state) => focusCommandBar(state));
      return;
    }

    if (currentState.commandBar.focus) {
      updateState((state) => insertCommandText(state, text));
    }
    return;
  }

  if (event.event.kind !== "key" || event.event.action !== "down") {
    return;
  }

  switch (event.event.key) {
    case ZR_KEY_ESCAPE:
      updateState((state) => cancelCommandState(state));
      break;
    case ZR_KEY_ENTER:
      break;
    case ZR_KEY_BACKSPACE:
      updateState((state) => backspaceCommandText(state));
      break;
    case ZR_KEY_DELETE:
      updateState((state) => deleteCommandText(state));
      break;
    case ZR_KEY_LEFT:
      updateState((state) => moveCommandCursor(state, -1));
      break;
    case ZR_KEY_RIGHT:
      updateState((state) => moveCommandCursor(state, 1));
      break;
  }
}
