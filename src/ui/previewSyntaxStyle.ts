import { RGBA, SyntaxStyle } from "@opentui/core";

export function buildPreviewSyntaxStyle(): SyntaxStyle {
  const text = RGBA.defaultForeground();
  const comment = RGBA.fromIndex(8);
  const keyword = RGBA.fromIndex(1);
  const string = RGBA.fromIndex(2);
  const number = RGBA.fromIndex(4);
  const func = RGBA.fromIndex(5);
  const type = RGBA.fromIndex(3);
  const property = RGBA.fromIndex(6);

  return SyntaxStyle.fromStyles({
    default: { fg: text },
    comment: { fg: comment, italic: true },
    string: { fg: string },
    number: { fg: number },
    boolean: { fg: number },
    constant: { fg: number },
    keyword: { fg: keyword },
    operator: { fg: keyword },
    function: { fg: func },
    type: { fg: type },
    constructor: { fg: type },
    property: { fg: property },
    "variable.member": { fg: property },
    variable: { fg: text },
    punctuation: { fg: text },
  });
}
