import {
  ScrollBoxRenderable,
  type RenderContext,
  type ScrollBoxOptions,
} from "@opentui/core";
import { extend } from "@opentui/solid";
import { synchronizeVerticalThumb } from "./scrollbarOptions.ts";

/** The application-wide ScrollBox variant registered for every JSX scrollbox. */
export class JifScrollBoxRenderable extends ScrollBoxRenderable {
  constructor(context: RenderContext, options: ScrollBoxOptions) {
    super(context, options);
    // Scrollbars start visible until their first layout-derived size update.
    // Calculate their automatic visibility immediately so newly mounted
    // scrollboxes do not flash both tracks for a frame.
    if (
      options.verticalScrollbarOptions?.visible === undefined &&
      options.scrollbarOptions?.visible === undefined
    ) {
      this.verticalScrollBar.resetVisibilityControl();
    }
    if (
      options.horizontalScrollbarOptions?.visible === undefined &&
      options.scrollbarOptions?.visible === undefined
    ) {
      this.horizontalScrollBar.resetVisibilityControl();
    }
    synchronizeVerticalThumb(this);
  }
}

extend({ scrollbox: JifScrollBoxRenderable });
