import type { ScrollBarRenderable, ScrollBoxRenderable } from "@opentui/core";

const synchronizedVerticalScrollbars = new WeakSet<ScrollBarRenderable>();

// opentui 0.4.x stores scrollbar track colors verbatim through their setters
// (`parseColor(undefined) === undefined`) and `ScrollBar.renderVertical`
// fills the track unconditionally, so handing it an `undefined` color makes a
// native `fillRect` dereference `undefined` and throw on every frame. opentui's
// render loop swallows that throw, which leaves the screen blank rather than
// crashing. Only forward colors that are actually defined and let opentui fall
// back to its own track defaults otherwise.
export type ScrollbarTrackOptions = Readonly<{
  trackOptions: {
    backgroundColor?: string;
    foregroundColor?: string;
  };
}>;

export function buildScrollbarTrackOptions(
  backgroundColor: string | undefined,
  foregroundColor: string | undefined,
): ScrollbarTrackOptions {
  const trackOptions: { backgroundColor?: string; foregroundColor?: string } = {};
  if (backgroundColor !== undefined) {
    trackOptions.backgroundColor = backgroundColor;
  }
  if (foregroundColor !== undefined) {
    trackOptions.foregroundColor = foregroundColor;
  }
  return { trackOptions };
}

/**
 * Synchronizes a vertical scrollbar's thumb with its viewport size.
 *
 * This is a version-dependent workaround for OpenTUI 0.4.x, which can retain
 * a stale slider viewport size after laying out scrollbox content. OpenTUI's
 * slider also clamps that size to the scroll range, so the range is widened
 * only while the correct viewport size is assigned and restored immediately.
 * The scrollbar's public size setters are wrapped so later layouts remain in
 * sync without requiring every caller to predict OpenTUI's layout timing.
 */
export function synchronizeVerticalThumb(scrollbox: ScrollBoxRenderable): void {
  const scrollbar = scrollbox.verticalScrollBar;
  if (!synchronizedVerticalScrollbars.has(scrollbar)) {
    synchronizedVerticalScrollbars.add(scrollbar);
    wrapScrollbarSizeSetter(scrollbar, "scrollSize");
    wrapScrollbarSizeSetter(scrollbar, "viewportSize");
  }
  synchronizeSliderViewport(scrollbar);
}

function wrapScrollbarSizeSetter(
  scrollbar: ScrollBarRenderable,
  property: "scrollSize" | "viewportSize",
): void {
  const descriptor = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(scrollbar),
    property,
  );
  if (!descriptor?.get || !descriptor.set) {
    return;
  }

  Object.defineProperty(scrollbar, property, {
    configurable: true,
    enumerable: descriptor.enumerable,
    get: () => descriptor.get!.call(scrollbar),
    set: (value: number) => {
      descriptor.set!.call(scrollbar, value);
      synchronizeSliderViewport(scrollbar);
    },
  });
}

function synchronizeSliderViewport(scrollbar: ScrollBarRenderable): void {
  const slider = scrollbar.slider;
  const viewportSize = Math.max(1, scrollbar.viewportSize);
  const originalMax = slider.max;

  slider.max = Math.max(originalMax, slider.min + viewportSize);
  slider.viewPortSize = viewportSize;
  slider.max = originalMax;
}
