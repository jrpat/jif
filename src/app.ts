import { render } from "@opentui/solid";
import type { AppConfig, ResolvedAppConfig } from "./config/schema.ts";
import type { AppLayout } from "./domain/types.ts";
import { JjClient } from "./jj/client.ts";
import { createPersistenceService } from "./persistence/service.ts";
import { createAppStore } from "./state/appStore.ts";
import { JifView } from "./ui/render.tsx";

const VALID_LAYOUTS: ReadonlySet<string> = new Set(["loose", "normal", "tight"]);

export async function runJifApplication(
  repoPath: string,
  config: ResolvedAppConfig,
  rawConfig: AppConfig,
  options: Readonly<{
    reloadConfig: () => Promise<{ raw: AppConfig; resolved: ResolvedAppConfig }>;
  }>,
): Promise<void> {
  const persistence = createPersistenceService();
  let layout = config.commands.layout;
  if (rawConfig.commands?.layout === undefined) {
    const saved = await persistence.loadLayoutPreference();
    if (VALID_LAYOUTS.has(saved)) {
      layout = saved as AppLayout;
    }
  }

  const store = createAppStore(repoPath, {
    useShortFlags: config.commands.shortFlags,
    layout,
    notificationHistoryLimit: config.notifications.historyLimit,
    previewWordWrap: config.preview.wordWrap,
  });
  const client = new JjClient(repoPath);

  await render(
    () => JifView({ store, client, config, rawConfig, reloadConfig: options.reloadConfig }),
    {
      exitOnCtrlC: true,
    },
  );
}
