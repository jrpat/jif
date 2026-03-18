#!/usr/bin/env python3

import base64
import json
import os
import pty
import select
import signal
import struct
import subprocess
import sys
import termios
import time
import fcntl


def set_winsize(fd: int, cols: int, rows: int) -> None:
    packed = struct.pack("HHHH", rows, cols, 0, 0)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, packed)


def drain_output(master_fd: int, chunks: list[bytes], idle_ms: int, timeout_ms: int) -> None:
    deadline = time.monotonic() + timeout_ms / 1000.0
    last_activity = time.monotonic()

    while True:
      now = time.monotonic()
      if now >= deadline:
          raise TimeoutError("timed out waiting for terminal output to go idle")
      if now - last_activity >= idle_ms / 1000.0:
          return

      timeout = min(0.05, deadline - now)
      readable, _, _ = select.select([master_fd], [], [], timeout)
      if not readable:
          continue

      data = os.read(master_fd, 65536)
      if not data:
          return
      chunks.append(data)
      last_activity = time.monotonic()


def main() -> int:
    payload = json.load(sys.stdin)
    command = payload["command"]
    cwd = payload["cwd"]
    env = payload["env"]
    viewport = payload["viewport"]
    actions = payload["actions"]

    master_fd, slave_fd = pty.openpty()
    set_winsize(slave_fd, int(viewport["cols"]), int(viewport["rows"]))

    proc = subprocess.Popen(
        command,
        cwd=cwd,
        env=env,
        stdin=slave_fd,
        stdout=slave_fd,
        stderr=slave_fd,
        start_new_session=True,
        close_fds=True,
    )
    os.close(slave_fd)

    chunks: list[bytes] = []

    try:
        for action in actions:
            kind = action["kind"]
            if kind == "input":
                os.write(master_fd, action["data"].encode("utf-8"))
                continue

            if kind == "wait":
                drain_output(
                    master_fd,
                    chunks,
                    int(action["idleMs"]),
                    int(action["timeoutMs"]),
                )
                continue

            raise RuntimeError(f"unknown action kind: {kind}")

        os.write(master_fd, b"\x03")
        try:
            proc.wait(timeout=0.75)
        except subprocess.TimeoutExpired:
            proc.send_signal(signal.SIGKILL)
            proc.wait(timeout=1.0)

        while True:
            readable, _, _ = select.select([master_fd], [], [], 0.05)
            if not readable:
                break
            data = os.read(master_fd, 65536)
            if not data:
                break
            chunks.append(data)
    finally:
        try:
            os.close(master_fd)
        except OSError:
            pass

    raw_bytes = b"".join(chunks)
    json.dump(
        {
            "rawAnsiBase64": base64.b64encode(raw_bytes).decode("ascii"),
        },
        sys.stdout,
    )
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
