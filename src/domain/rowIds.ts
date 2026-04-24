const ROW_ID_SEPARATOR = ":";

export function createRowId(commitIdentity: string, revisionId: string): string {
  return `${commitIdentity}${ROW_ID_SEPARATOR}${revisionId}`;
}

export function createSyntheticRowId(kind: string, value: string): string {
  return `synthetic${ROW_ID_SEPARATOR}${kind}${ROW_ID_SEPARATOR}${value}`;
}