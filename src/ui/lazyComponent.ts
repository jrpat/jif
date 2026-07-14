import { createComponent, createSignal, type Component, type JSX } from "solid-js";

export type LazyUiComponent<P extends Record<string, unknown>> = Component<P> & {
  preload: () => Promise<void>;
};

// solid-js's lazy() is unusable here: while its import is pending it inserts
// an empty text placeholder, and OpenTUI's reconciler rejects bare text
// outside <text> parents. This renders nothing until the module resolves,
// then swaps the real component in on the next frame. Modules load once and
// are cached, so later mounts render synchronously.
export function lazyComponent<P extends Record<string, unknown>>(
  load: () => Promise<Component<P>>,
): LazyUiComponent<P> {
  let cached: Component<P> | null = null;
  let loading: Promise<void> | null = null;

  const ensureLoaded = () => {
    loading ??= load().then((component) => {
      cached = component;
    });
    return loading;
  };

  const wrapper = (props: P): JSX.Element => {
    if (cached) {
      return createComponent(cached, props);
    }

    const [component, setComponent] = createSignal<Component<P> | null>(null);
    void ensureLoaded().then(() => setComponent(() => cached));

    return (() => {
      const resolved = component();
      return resolved ? createComponent(resolved, props) : null;
    }) as unknown as JSX.Element;
  };

  return Object.assign(wrapper, { preload: ensureLoaded });
}
