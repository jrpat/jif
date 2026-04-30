function jsonString(expr: string): string {
  return `stringify(${expr}).escape_json()`;
}

function jsonBoolean(expr: string): string {
  return `if(${expr}, "true", "false")`;
}

function jsonField(name: string, valueExpr: string): string {
  return `"\\"${name}\\": " ++ ${valueExpr}`;
}

function jsonObject(fields: Record<string, string>): string {
  const entries = Object.entries(fields).map(([name, valueExpr]) => jsonField(name, valueExpr));
  return `"{" ++ ${entries.join(" ++ \",\" ++ ")} ++ "}"`;
}

function jsonObjectArray(expr: string, loopVar: string, fields: Record<string, string>): string {
  const inner = jsonObject(fields);
  return `"[" ++ ${expr}.map(|${loopVar}| ${inner}).join(",") ++ "]"`;
}

function jsonStringArray(expr: string, loopVar: string, valueExpr: string): string {
  return `"[" ++ ${expr}.map(|${loopVar}| "\\"" ++ ${valueExpr} ++ "\\"").join(",") ++ "]"`;
}

export const STATUS_TEMPLATE = `${jsonObject({
  change_id: jsonString("change_id"),
  commit_id: jsonString("commit_id"),
  description: jsonString("description"),
  empty: jsonBoolean("self.empty()"),
  conflict: jsonBoolean("self.conflict()"),
  divergent: jsonBoolean("self.divergent()"),
  change_offset: jsonString('if(self.change_offset(), self.change_offset(), "")'),
  local_bookmarks: jsonStringArray("self.local_bookmarks()", "bookmark", "bookmark.name()"),
  diff_files: jsonObjectArray("self.diff().files()", "entry", {
    status_char: jsonString("entry.status_char()"),
    source_path: jsonString("entry.source().path().display()"),
    target_path: jsonString("entry.target().path().display()"),
    is_conflict: jsonBoolean("entry.target().conflict()"),
  }),
  conflicted_files: jsonStringArray("self.conflicted_files()", "path", "path.path().display()"),
})} ++ "\\n"`;

export const SHOW_TEMPLATE = `${jsonObject({
  change_id: jsonString("change_id"),
  commit_id: jsonString("commit_id"),
  description: jsonString("description"),
  empty: jsonBoolean("self.empty()"),
  conflict: jsonBoolean("self.conflict()"),
  divergent: jsonBoolean("self.divergent()"),
  change_offset: jsonString('if(self.change_offset(), self.change_offset(), "")'),
  local_bookmarks: jsonStringArray("self.local_bookmarks()", "bookmark", "bookmark.name()"),
  diff_files: jsonObjectArray("self.diff().files()", "entry", {
    status_char: jsonString("entry.status_char()"),
    source_path: jsonString("entry.source().path().display()"),
    target_path: jsonString("entry.target().path().display()"),
    is_conflict: jsonBoolean("entry.target().conflict()"),
  }),
  conflicted_files: jsonStringArray("self.conflicted_files()", "path", "path.path().display()"),
})} ++ "\\n"`;

export const OPERATION_LOG_TEMPLATE = `${jsonObject({
  id: jsonString("self.id()"),
  description: jsonString("self.description()"),
  tags: jsonString("self.tags()"),
  start: jsonString("self.time().start()"),
  user: jsonString("self.user()"),
  snapshot: jsonBoolean("self.snapshot()"),
})} ++ "\\n"`;