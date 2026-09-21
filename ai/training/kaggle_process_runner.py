"""
Runs a long child process from a Kaggle/Jupyter notebook cell and streams a
FILTERED copy of its output back — Milestone 7.

Why this exists (real Kaggle runs, see AI_TASKS.md): training printed a
`MatMul8bitLt` warning per layer per step, over a million lines an epoch. Four
attempts to silence it from inside Python (filterwarnings, showwarning,
sys.stdout/stderr wrappers, fd redirection) each passed offline and each failed
on Kaggle, and the flood coincided with a worsening slowdown. Instead of trying
to stop the child from printing, the child writes to a pipe that this module
drains promptly (so it can never block on a slow browser) and only forwards what
is worth reading:

  - lines containing a `noise_substrings` entry are dropped (and counted), along
    with the single indented source-echo line Python prints right after a
    warning;
  - any other exactly-repeated line is shown `max_repeats` times, then
    suppressed and counted — a generic guard for a flood we did not anticipate;
  - a heartbeat fires if nothing real has been printed for `heartbeat_seconds`,
    so "slow" and "hung" can be told apart (the callback typically prints
    nvidia-smi).

What is shown is also appended to `log_path`, so it survives a closed browser.
Pure standard library: unit-tested locally with no GPU stack.
"""
import queue
import subprocess
import threading
import time

_MAX_TRACKED_LINES = 10_000  # bound memory if a flood turns out to have many distinct lines


class LineFilter:
    """Decides, line by line, whether output is worth showing. Stateful: not thread-safe (single consumer)."""

    def __init__(self, noise_substrings=(), max_repeats: int = 3):
        self._noise = tuple(noise_substrings)
        self._max_repeats = max_repeats
        self._counts: dict[str, int] = {}
        self._drop_next_indented = False
        self.dropped_noise = 0
        self.suppressed_repeats = 0

    def should_show(self, line: str) -> bool:
        if any(needle in line for needle in self._noise):
            self.dropped_noise += 1
            self._drop_next_indented = True  # `warnings` echoes the offending source line, indented, next
            return False
        if self._drop_next_indented:
            self._drop_next_indented = False
            if line[:1] in (" ", "\t"):
                self.dropped_noise += 1
                return False

        key = line.rstrip("\n")
        if key.strip() and (key in self._counts or len(self._counts) < _MAX_TRACKED_LINES):
            seen = self._counts.get(key, 0) + 1
            self._counts[key] = seen
            if seen > self._max_repeats:
                self.suppressed_repeats += 1
                return False
        return True


def run_and_stream(
    cmd,
    env=None,
    log_path=None,
    noise_substrings=(),
    max_repeats: int = 3,
    heartbeat_seconds: float = 300.0,
    on_heartbeat=None,
    echo=print,
) -> int:
    """Run `cmd` to completion, echoing filtered output. Returns the child's exit code."""
    line_filter = LineFilter(noise_substrings, max_repeats)
    process = subprocess.Popen(
        cmd,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        bufsize=1,
    )

    lines: "queue.Queue[str | None]" = queue.Queue()

    def _drain() -> None:
        for line in process.stdout:
            lines.put(line)
        lines.put(None)

    threading.Thread(target=_drain, daemon=True).start()

    poll_seconds = max(0.05, min(heartbeat_seconds, 30.0))
    last_real_output = time.monotonic()
    last_heartbeat = last_real_output
    log = open(log_path, "a", encoding="utf-8") if log_path else None
    try:
        while True:
            try:
                item = lines.get(timeout=poll_seconds)
            except queue.Empty:
                item = ""  # no line this tick; still fall through to the heartbeat check
            if item is None:
                break
            if item and line_filter.should_show(item):
                text = item.rstrip("\n")
                echo(text)
                if log:
                    log.write(text + "\n")
                    log.flush()
                last_real_output = time.monotonic()

            now = time.monotonic()
            if now - last_real_output >= heartbeat_seconds and now - last_heartbeat >= heartbeat_seconds:
                last_heartbeat = now
                echo(
                    f"[heartbeat] {int(now - last_real_output)}s chưa có dòng mới; "
                    f"tiến trình con {'còn chạy' if process.poll() is None else 'ĐÃ DỪNG'}."
                )
                if on_heartbeat:
                    on_heartbeat()

        exit_code = process.wait()
        summary = (
            f"[runner] mã thoát {exit_code}; đã ẩn {line_filter.dropped_noise} dòng cảnh báo lặp, "
            f"{line_filter.suppressed_repeats} dòng trùng."
        )
        echo(summary)
        if log:
            log.write(summary + "\n")
        return exit_code
    finally:
        if log:
            log.close()
