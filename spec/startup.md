# Startup

Startup speed is a high-priority product constraint. Repository validation must
not add a dedicated `jj` invocation to the launch path: the initial `jj log`
load is the authoritative validity check, and its failure is propagated to the
process instead of being converted into a toast.

Repository loading stays concurrent with terminal palette detection so neither
operation serially delays the first visible frame. If the initial log fails
because the launch directory is not a Jujutsu repository, jif restores the
terminal, writes an error to stderr, and exits with status 1. Refresh failures
after startup remain recoverable UI notifications.
