import { render } from "@opentui/solid";
import type { ResolvedAppConfig } from "./config/index.ts";
import { JjClient } from "./jj/client.ts";
import { createAppStore } from "./state/appStore.ts";
import { JifView } from "./ui/render.tsx";

export async function runJifApplication(
  repoPath: string,
  config: ResolvedAppConfig,
): Promise<void> {
  const store = createAppStore(repoPath);
  const client = new JjClient(repoPath);

  await render(
    () => JifView({ store, client, config }),
    {
      exitOnCtrlC: true,
    },
  );
}
