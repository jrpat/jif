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
