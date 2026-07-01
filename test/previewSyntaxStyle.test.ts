import { expect, test } from "bun:test";
import { ansi256IndexToRgb } from "@opentui/core";
import { buildPreviewSyntaxStyle } from "../src/ui/previewSyntaxStyle.ts";

test("preview syntax style uses indexed ANSI colors", () => {
  const style = buildPreviewSyntaxStyle();

  const keyword = style.getStyle("keyword");
  const string = style.getStyle("string");
  const number = style.getStyle("number");
  const func = style.getStyle("function");
  const type = style.getStyle("type");
  const property = style.getStyle("property");
  const comment = style.getStyle("comment");
  const defaultStyle = style.getStyle("default");

  expect(keyword?.fg?.intent).toBe("indexed");
  expect(keyword?.fg?.slot).toBe(1);
  expect(keyword?.fg?.toInts().slice(0, 3)).toEqual([...ansi256IndexToRgb(1)]);
  expect(keyword?.bold).toBeUndefined();

  expect(string?.fg?.slot).toBe(2);
  expect(number?.fg?.slot).toBe(4);
  expect(func?.fg?.slot).toBe(5);
  expect(type?.fg?.slot).toBe(3);
  expect(property?.fg?.slot).toBe(6);
  expect(comment?.fg?.slot).toBe(8);
  expect(comment?.italic).toBe(true);

  expect(defaultStyle?.fg?.intent).toBe("default");
});
