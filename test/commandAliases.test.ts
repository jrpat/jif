import { expect, test } from "bun:test";
import { parseCommandAliasConfigOutput } from "../src/jj/commandAliases.ts";

const US = "\u001f";
const RS = "\u001e";

test("parseCommandAliasConfigOutput reads supported command aliases", () => {
  const output = [
    `aliases.g${US}["git"]${RS}`,
    `aliases.pull${US}["git", "fetch"]${RS}`,
    `aliases.mine${US}["bookmark", "list", "-r", "mine()"]${RS}`,
  ].join("");

  expect(parseCommandAliasConfigOutput(output)).toEqual([
    { name: "g", expansion: ["git"] },
    { name: "pull", expansion: ["git", "fetch"] },
    { name: "mine", expansion: ["bookmark", "list", "-r", "mine()"] },
  ]);
});

test("parseCommandAliasConfigOutput ignores util and invalid aliases", () => {
  const output = [
    `aliases.up${US}[
  "util", "exec", "--", "bash", "-c",
  """
  echo hi
  """, ""
]${RS}`,
    `aliases.flaggy${US}["--help"]${RS}`,
    `aliases.empty${US}[]${RS}`,
    `aliases.bad${US}"git"${RS}`,
    `aliases.pull${US}["git", "fetch"]${RS}`,
  ].join("");

  expect(parseCommandAliasConfigOutput(output)).toEqual([
    { name: "pull", expansion: ["git", "fetch"] },
  ]);
});

test("parseCommandAliasConfigOutput handles quoted alias keys", () => {
  const output = `aliases."my.alias"${US}["log"]${RS}`;

  expect(parseCommandAliasConfigOutput(output)).toEqual([
    { name: "my.alias", expansion: ["log"] },
  ]);
});
