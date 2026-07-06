import { expect, test } from "bun:test";
import { ScrollBoxRenderable } from "@opentui/core";
import { testRender } from "@opentui/solid";
import { resolveAppConfig, type ResolvedAppConfig } from "../src/config/index.ts";
import { AutocompleteList } from "../src/ui/AutocompleteList.tsx";

function configWithoutScrollbarColors(): ResolvedAppConfig {
  const config = resolveAppConfig({});
  return {
    ...config,
    colorScheme: {
      semanticColors: {
        ...config.colorScheme.semanticColors,
        chromeFillThree: undefined,
        chromeScrollbarThumb: undefined,
      },
    },
  };
}

function findScrollbox(root: { getChildren?: () => unknown[] }): ScrollBoxRenderable | undefined {
  for (const child of root.getChildren?.() ?? []) {
    if (child instanceof ScrollBoxRenderable) {
      return child;
    }

    const found = findScrollbox(child as { getChildren?: () => unknown[] });
    if (found) {
      return found;
    }
  }
}

test("scrollbars preserve OpenTUI defaults when scrollbar semantic colors are unavailable", async () => {
  const items = Array.from({ length: 12 }, (_, index) => ({
    id: `item-${index}`,
    text: `item ${index}`,
  }));
  const rendered = await testRender(
    () => (
      <AutocompleteList
        items={items}
        selectedIndex={0}
        flow="top-to-bottom"
        config={configWithoutScrollbarColors()}
        maxVisibleItems={4}
      />
    ),
    { width: 32, height: 5 },
  );

  try {
    await rendered.renderOnce();
    const scrollbox = findScrollbox(rendered.renderer.root);

    expect(scrollbox).toBeDefined();
    expect(scrollbox?.verticalScrollBar.slider.backgroundColor).toBeDefined();
    expect(scrollbox?.verticalScrollBar.slider.foregroundColor).toBeDefined();
  } finally {
    rendered.renderer.destroy();
  }
});
