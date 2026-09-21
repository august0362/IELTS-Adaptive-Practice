import os
import sys

from training.kaggle_process_runner import LineFilter, run_and_stream

NOISE = ["MatMul8bitLt: inputs will be cast"]
FLOOD_LINE = "UserWarning: MatMul8bitLt: inputs will be cast from torch.bfloat16 to float16 during quantization"


def _py(code):
    return [sys.executable, "-c", code]


class TestLineFilter:
    def test_drops_noise_and_the_indented_source_echo_python_prints_after_it(self):
        f = LineFilter(NOISE)
        assert f.should_show("real progress\n")
        assert not f.should_show(f"x.py:1: {FLOOD_LINE}\n")
        assert not f.should_show("  return MatMul8bitLt.apply(A, B)\n")
        assert f.dropped_noise == 2

    def test_only_one_indented_line_after_noise_is_swallowed(self):
        f = LineFilter(NOISE)
        f.should_show(FLOOD_LINE + "\n")
        f.should_show("  return MatMul8bitLt.apply(A, B)\n")
        assert f.should_show("  indented but real\n")

    def test_an_indented_line_not_preceded_by_noise_is_kept(self):
        assert LineFilter(NOISE).should_show('  File "train.py", line 3, in <module>\n')

    def test_keeps_a_real_error_that_merely_mentions_the_class_name(self):
        assert LineFilter(NOISE).should_show("RuntimeError: bad shape in MatMul8bitLt.forward\n")

    def test_suppresses_exact_repeats_after_max_repeats(self):
        f = LineFilter(max_repeats=3)
        shown = [f.should_show("same line\n") for _ in range(6)]
        assert shown == [True, True, True, False, False, False]
        assert f.suppressed_repeats == 3

    def test_never_suppresses_progress_lines_whose_numbers_change(self):
        f = LineFilter(max_repeats=3)
        assert all(f.should_show(f"{{'loss': {i / 10}}}\n") for i in range(200))
        assert f.suppressed_repeats == 0

    def test_never_suppresses_blank_lines(self):
        f = LineFilter(max_repeats=1)
        assert all(f.should_show("\n") for _ in range(5))


class TestRunAndStream:
    def test_forwards_real_lines_hides_a_flood_and_returns_the_exit_code(self, tmp_path):
        code = (
            "import sys\n"
            "print('start')\n"
            "for i in range(3000):\n"
            f"    print({FLOOD_LINE!r})\n"
            "    print('  return MatMul8bitLt.apply(A)')\n"
            "print('step 1 done')\n"
            "print('err line', file=sys.stderr)\n"
            "sys.exit(3)\n"
        )
        shown = []
        log = tmp_path / "train.log"

        rc = run_and_stream(_py(code), log_path=str(log), noise_substrings=NOISE, echo=shown.append)

        assert rc == 3
        assert shown[0] == "start"
        assert "step 1 done" in shown
        assert "err line" in shown  # stderr is merged into the same stream
        assert not any("MatMul8bitLt" in line for line in shown)
        assert any("mã thoát 3" in line and "6000" in line for line in shown)
        assert log.read_text(encoding="utf-8").splitlines() == shown

    def test_returns_zero_on_success(self):
        assert run_and_stream(_py("print('ok')"), echo=lambda line: None) == 0

    def test_decodes_utf8_child_output(self):
        shown = []
        env = {**os.environ, "PYTHONIOENCODING": "utf-8"}
        run_and_stream(_py("print('Đã lưu adapter')"), env=env, echo=shown.append)
        assert "Đã lưu adapter" in shown

    def test_heartbeat_fires_while_the_child_is_silent_and_says_it_is_alive(self):
        beats = []
        shown = []
        code = "import time; print('go', flush=True); time.sleep(1.6); print('bye')"

        rc = run_and_stream(_py(code), heartbeat_seconds=0.5, on_heartbeat=lambda: beats.append(1), echo=shown.append)

        assert rc == 0
        assert beats
        assert any("[heartbeat]" in line and "còn chạy" in line for line in shown)
        assert "bye" in shown
