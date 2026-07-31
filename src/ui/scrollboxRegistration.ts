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
    synchronizeVerticalThumb(this);
  }
}

extend({ scrollbox: JifScrollBoxRenderable });
