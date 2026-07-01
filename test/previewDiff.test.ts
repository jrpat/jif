import { describe, expect, test } from "bun:test";
import { countDiffRows, fileTypeForPath, splitGitDiff } from "../src/domain/previewDiff.ts";

const threeFile = `diff --git a/one.ts b/one.ts
index 1111111..2222222 100644
--- a/one.ts
+++ b/one.ts
@@ -1,2 +1,3 @@
 context
-old
+new
+added
diff --git a/dir/two.js b/dir/two.js
new file mode 100644
index 0000000..3333333
--- /dev/null
+++ b/dir/two.js
@@ -0,0 +1 @@
+hello
diff --git a/three.md b/three.md
deleted file mode 100644
index 4444444..0000000
--- a/three.md
+++ /dev/null
@@ -1 +0,0 @@
-gone
`;

describe("splitGitDiff", () => {
  test("splits a multi-file patch and derives paths", () => {
    const files = splitGitDiff(threeFile);
    expect(files.map((f) => f.path)).toEqual(["one.ts", "dir/two.js", "three.md"]);
    expect(files[0]!.patch.startsWith("diff --git a/one.ts")).toBe(true);
  });

  test("single-file diff passes through as one entry", () => {
    const single = splitGitDiff(threeFile.split("\ndiff --git a/dir")[0]!);
    expect(single.length).toBe(1);
    expect(single[0]!.path).toBe("one.ts");
  });

  test("drops leading and trailing interleaved annotation (op-diff shape)", () => {
    const opDiff = `Changed commits:
○  + abc 123 (desc)
diff --git a/x.ts b/x.ts
--- a/x.ts
+++ b/x.ts
@@ -1 +1 @@
-a
+b
Changed working copy:
+ abc 123
`;
    const files = splitGitDiff(opDiff);
    expect(files.length).toBe(1);
    expect(files[0]!.path).toBe("x.ts");
    expect(files[0]!.patch).not.toContain("Changed working copy");
    expect(countDiffRows(files[0]!.patch)).toBe(2);
  });

  test("empty input yields no files", () => {
    expect(splitGitDiff("")).toEqual([]);
    expect(splitGitDiff("\n  \n")).toEqual([]);
  });
});

describe("countDiffRows", () => {
  test("counts only in-hunk body lines", () => {
    const files = splitGitDiff(threeFile);
    expect(countDiffRows(files[0]!.patch)).toBe(4); // context, old, new, added
    expect(countDiffRows(files[1]!.patch)).toBe(1);
    expect(countDiffRows(files[2]!.patch)).toBe(1);
  });

  test("ignores '\\ No newline' markers and header lines", () => {
    const patch = `diff --git a/f b/f
--- a/f
+++ b/f
@@ -1,2 +1,2 @@
 keep
-remove
\\ No newline at end of file
+addit
\\ No newline at end of file`;
    expect(countDiffRows(patch)).toBe(3); // keep, remove, addit
  });

  test("binary/no-hunk patch has zero rows", () => {
    const patch = `diff --git a/img.png b/img.png
index 1111111..2222222 100644
Binary files a/img.png and b/img.png differ`;
    expect(countDiffRows(patch)).toBe(0);
  });
});

describe("fileTypeForPath", () => {
  test("returns OpenTUI's canonical syntax filetype", () => {
    expect(fileTypeForPath("dir/one.ts")).toBe("typescript");
    expect(fileTypeForPath("a/b/c.test.js")).toBe("javascript");
  });

  test("returns empty for unknown dotfile paths", () => {
    expect(fileTypeForPath(".gitignore")).toBe("");
  });
});
