// Compiled binaries substitute process.env.JIF_VERSION at build time via a
// Bun.build define; running from source leaves it unset and reports "dev".
export function jifVersion(): string {
  return process.env.JIF_VERSION?.trim() || "dev";
}
