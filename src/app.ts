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
import type { ResolvedAppConfig } from "./config/index.ts";
import { createBindings } from "./commands/definitions.ts";
import type { AppState } from "./domain/types.ts";
import { JjClient } from "./jj/client.ts";
import { createAppStore, type AppStore } from "./state/appStore.ts";
import {
  commandCanExecute,
  getDisplayedCommandText,
  getFocusedRevision,
} from "./state/store.ts";
import { renderApp } from "./ui/render.tsx";

export async function createJifApplication(
  repoPath: string,
  config: ResolvedAppConfig,
) {
  const client = new JjClient(repoPath);
  let app!: ReturnType<typeof createNodeApp<AppState>>;

  const store = createAppStore(repoPath, () => {
    app.update(() => store.snapshot());
  });

  app = createNodeApp<AppState>({
    initialState: store.snapshot(),
    theme: config.colorScheme.theme,
    config: {
      fpsCap: 30,
      executionMode: "inline",
      themeTransitionFrames: 4,
      rootPadding: 0,
    },
  });

  const controller = {
    moveFocus(delta: number) {
      store.actions.moveFocus(delta);
    },
    openFocusedRevision() {
      const revision = getFocusedRevision(store.snapshot());
      if (!revision) {
        return;
      }

      store.actions.openFocusedRevision();
      if (revision.files.length === 0) {
        void (async () => {
          try {
            const files = await client.loadChangedFiles(revision.changeId);
            store.actions.setRevisionFiles(revision.changeId, files);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            store.actions.pushEvent(message, "error");
          }
        })();
      }
    },
    closeFocusedRevision() {
      store.actions.closeFocusedRevision();
    },
    cancelOrBlur() {
      store.actions.cancelCommand();
    },
    confirm() {
      void executeCurrentCommand();
    },
    startRebase() {
      const revision = getFocusedRevision(store.snapshot());
      if (!revision) {
        return;
      }

      void (async () => {
        try {
          const descendants = await client.resolveDescendants(revision.changeId);
          store.actions.startRebaseCommand(descendants);
          store.actions.pushEvent(`Composing rebase for ${revision.changeId}`, "info");
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          store.actions.pushEvent(message, "error");
        }
      })();
    },
    toggleRebaseDescendants() {
      const draft = store.snapshot().commandDraft;
      if (draft?.kind !== "rebase") {
        return;
      }

      void (async () => {
        try {
          const descendants = await client.resolveDescendants(draft.sourceRevisionId);
          store.actions.toggleRebaseDescendants(descendants);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          store.actions.pushEvent(message, "error");
        }
      })();
    },
  };

  app.view(() => {
    return renderApp(store.state, config);
  });

  app.keys(createBindings(controller));
  app.onEvent((event) => {
    handleEvent(event, store);
  });

  async function refreshRepository() {
    store.actions.setLoading(true);
    try {
      await client.verifyRepository();
      const repositoryData = await client.loadRepository();
      store.actions.applyRepositoryData(repositoryData);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      store.actions.setError(message);
      store.actions.pushEvent(message, "error");
    }
  }

  async function executeCurrentCommand() {
    const state = store.snapshot();
    if (!commandCanExecute(state)) {
      return;
    }

    const commandText = getDisplayedCommandText(state).trim();
    if (commandText.length === 0) {
      return;
    }

    store.actions.setLoading(true);

    try {
      const resultMessage = await client.executeCommand(commandText);
      store.actions.cancelCommand();
      store.actions.pushEvent(resultMessage, "success");
      await refreshRepository();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      store.actions.pushEvent(message, "error");
      store.actions.setLoading(false);
    }
  }

  return {
    app,
    refreshRepository,
    dispose: store.dispose,
  };
}

function handleEvent(
  event: UiEvent,
  store: AppStore,
) {
  if (event.kind !== "engine") {
    return;
  }

  if (event.event.kind === "text") {
    const text = String.fromCodePoint(event.event.codepoint);
    if (!store.snapshot().commandBar.focus && text === ":") {
      store.actions.focusCommandBar();
      return;
    }

    if (store.snapshot().commandBar.focus) {
      store.actions.insertCommandText(text);
    }
    return;
  }

  if (event.event.kind !== "key" || event.event.action !== "down") {
    return;
  }

  switch (event.event.key) {
    case ZR_KEY_ESCAPE:
      store.actions.cancelCommand();
      break;
    case ZR_KEY_ENTER:
      break;
    case ZR_KEY_BACKSPACE:
      store.actions.backspaceCommandText();
      break;
    case ZR_KEY_DELETE:
      store.actions.deleteCommandText();
      break;
    case ZR_KEY_LEFT:
      store.actions.moveCommandCursor(-1);
      break;
    case ZR_KEY_RIGHT:
      store.actions.moveCommandCursor(1);
      break;
  }
}
