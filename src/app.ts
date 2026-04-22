import { render } from "@opentui/solid";
import type { AppConfig, ResolvedAppConfig } from "./config/schema.ts";
import { JjClient } from "./jj/client.ts";
import { createAppStore } from "./state/appStore.ts";
import { JifView } from "./ui/render.tsx";

export async function runJifApplication(
  repoPath: string,
  config: ResolvedAppConfig,
  rawConfig: AppConfig,
): Promise<void> {
  const store = createAppStore(repoPath, {
    useShortFlags: config.commands.shortFlags,
    layout: config.commands.layout,
  });
  const client = new JjClient(repoPath);

  await render(
    () => JifView({ store, client, config, rawConfig }),
    {
      exitOnCtrlC: true,
    },
  );
}
