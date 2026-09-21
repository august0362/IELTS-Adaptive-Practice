import sys

import pytest

from training import lora_train_script as script
from training.lora_train_script import (
    NOISE_SUBSTRINGS,
    build_child_env,
    build_launch_command,
    decode_throttle_reasons,
    diagnose,
    grad_accum_steps,
    parse_args,
    parse_nvidia_smi_csv,
    summarize_step_times,
)


class TestGradAccumSteps:
    def test_keeps_effective_batch_constant_across_gpu_counts(self):
        assert grad_accum_steps(1) == 4
        assert grad_accum_steps(2) == 2
        assert grad_accum_steps(4) == 1

    def test_never_drops_below_one(self):
        assert grad_accum_steps(8) == 1

    @pytest.mark.parametrize("world_size, per_device, target", [(0, 1, 4), (1, 0, 4), (1, 1, 0)])
    def test_rejects_non_positive_arguments(self, world_size, per_device, target):
        with pytest.raises(ValueError):
            grad_accum_steps(world_size, per_device, target)


class TestBuildLaunchCommand:
    def test_uses_torch_distributed_run_with_standalone_rendezvous(self):
        cmd = build_launch_command(2, "train.py", ["--epochs", "1"])
        assert cmd[0] == sys.executable
        assert cmd[1:3] == ["-m", "torch.distributed.run"]
        assert "--standalone" in cmd
        assert "--nproc_per_node=2" in cmd
        assert cmd[-3:] == ["train.py", "--epochs", "1"]

    def test_rejects_zero_gpus(self):
        with pytest.raises(ValueError):
            build_launch_command(0, "train.py")


class TestBuildChildEnv:
    def test_sets_multi_gpu_and_allocator_defaults(self):
        env = build_child_env({"PATH": "x"})
        assert env["NCCL_P2P_DISABLE"] == "1"
        assert env["NCCL_IB_DISABLE"] == "1"
        assert env["PYTORCH_CUDA_ALLOC_CONF"] == "expandable_segments:True"
        assert env["PYTHONUNBUFFERED"] == "1"
        assert env["PYTHONIOENCODING"] == "utf-8"
        assert env["PATH"] == "x"

    def test_a_value_the_caller_already_chose_wins(self):
        assert build_child_env({"NCCL_P2P_DISABLE": "0"})["NCCL_P2P_DISABLE"] == "0"

    def test_does_not_mutate_its_input(self):
        base = {"PATH": "x"}
        build_child_env(base)
        assert base == {"PATH": "x"}


class TestNoiseSubstrings:
    def test_matches_the_flood_warning(self):
        line = "UserWarning: MatMul8bitLt: inputs will be cast from torch.bfloat16 to float16 during quantization"
        assert any(n in line for n in NOISE_SUBSTRINGS)

    def test_is_narrow_enough_not_to_hide_a_real_error(self):
        real_error = "RuntimeError: shape mismatch inside MatMul8bitLt.forward"
        assert not any(n in real_error for n in NOISE_SUBSTRINGS)


class TestDecodeThrottleReasons:
    def test_hex_string_as_nvidia_smi_prints_it(self):
        assert decode_throttle_reasons("0x0000000000000004") == ["sw_power_cap"]

    def test_several_bits_at_once(self):
        assert decode_throttle_reasons(0x24) == ["sw_power_cap", "sw_thermal_slowdown"]

    def test_zero_and_unparseable_give_no_reasons(self):
        assert decode_throttle_reasons("0x0") == []
        assert decode_throttle_reasons("[N/A]") == []
        assert decode_throttle_reasons(None) == []


class TestParseNvidiaSmiCsv:
    FIELDS = ("utilization.gpu", "temperature.gpu", "power.draw", "clocks.sm", "clocks.max.sm")

    def test_parses_numbers(self):
        parsed = parse_nvidia_smi_csv("98, 71, 69.50, 585, 1590\n", self.FIELDS)
        assert parsed == {
            "utilization.gpu": 98.0,
            "temperature.gpu": 71.0,
            "power.draw": 69.5,
            "clocks.sm": 585.0,
            "clocks.max.sm": 1590.0,
        }

    def test_not_available_becomes_none(self):
        assert parse_nvidia_smi_csv("98, [N/A], 69.5, 585, 1590", self.FIELDS)["temperature.gpu"] is None

    @pytest.mark.parametrize("text", ["", "   \n", "1, 2"])
    def test_unexpected_shape_gives_empty_dict(self, text):
        assert parse_nvidia_smi_csv(text, self.FIELDS) == {}


class _Result:
    def __init__(self, returncode=0, stdout=""):
        self.returncode = returncode
        self.stdout = stdout


class TestQueryGpu:
    def test_returns_empty_and_never_raises_when_nvidia_smi_is_missing(self, monkeypatch):
        def boom(*args, **kwargs):
            raise FileNotFoundError("nvidia-smi")

        monkeypatch.setattr(script.subprocess, "run", boom)
        assert script.query_gpu(0) == {}

    def test_falls_back_to_the_older_throttle_field_name(self, monkeypatch):
        main_query = "--query-gpu=" + ",".join(script._GPU_QUERY_FIELDS)

        def fake_run(cmd, **kwargs):
            query = next(c for c in cmd if c.startswith("--query-gpu="))
            if query == main_query:
                return _Result(0, "50, 60, 70.0, 585, 1590\n")
            if "clocks_event_reasons" in query:
                return _Result(2, "")  # older driver: unknown field
            return _Result(0, "0x0000000000000020\n")

        monkeypatch.setattr(script.subprocess, "run", fake_run)
        info = script.query_gpu(0)
        assert info["utilization.gpu"] == 50.0
        assert info["throttle_reasons"] == ["sw_thermal_slowdown"]


class TestSummarizeStepTimes:
    def test_flags_progressive_slowdown_and_ignores_the_warmup_step(self):
        times = [90.0] + [8.0] * 5 + [9.0] * 10 + [40.0] * 5
        summary = summarize_step_times(times)
        assert summary["enough_data"] is True
        assert summary["first_median_s"] == 8.0
        assert summary["last_median_s"] == 40.0
        assert summary["ratio"] == 5.0
        assert summary["progressive_slowdown"] is True

    def test_steady_run_is_not_flagged_even_with_a_slow_first_step(self):
        summary = summarize_step_times([90.0] + [8.0] * 20)
        assert summary["progressive_slowdown"] is False

    def test_too_few_steps_gives_no_verdict(self):
        assert summarize_step_times([8.0] * 10) == {"steps": 10, "enough_data": False}


def _step_records(seconds, retries=None, throttle=None):
    records = [{"event": "train_begin", "rank": 0}]
    for i, s in enumerate(seconds):
        record = {"event": "step", "rank": 0, "step": i + 1, "step_seconds": s}
        if retries is not None:
            record["alloc_retries"] = retries[i]
        if throttle is not None:
            record["gpu"] = {"throttle_reasons": throttle}
        records.append(record)
    return records


SLOWING = [30.0] + [8.0] * 5 + [9.0] * 10 + [40.0] * 5
STEADY = [30.0] + [8.0] * 20


class TestDiagnose:
    def test_healthy_run(self):
        assert "Không thấy chậm dần bất thường." in diagnose(_step_records(STEADY))

    def test_no_step_records_means_training_never_started(self):
        assert "chưa chạy được" in diagnose([{"event": "train_begin"}])[0]

    def test_too_few_steps(self):
        assert "chưa đủ" in diagnose(_step_records([8.0] * 4))[0]

    def test_growing_allocator_retries_point_at_memory_pressure(self):
        retries = list(range(len(SLOWING)))
        text = "\n".join(diagnose(_step_records(SLOWING, retries=retries)))
        assert "thử lại" in text
        assert "max_length" in text
        assert "CPU / I/O" not in text

    def test_harmful_throttling_is_reported(self):
        text = "\n".join(diagnose(_step_records(SLOWING, retries=[0] * len(SLOWING), throttle=["sw_thermal_slowdown"])))
        assert "giảm xung" in text
        assert "sw_thermal_slowdown" in text

    def test_benign_throttle_reasons_do_not_count_as_a_cause(self):
        text = "\n".join(diagnose(_step_records(SLOWING, retries=[0] * len(SLOWING), throttle=["gpu_idle"])))
        assert "giảm xung" not in text
        assert "CPU / I/O" in text

    def test_slowdown_with_no_memory_or_throttle_evidence_points_elsewhere(self):
        text = "\n".join(diagnose(_step_records(SLOWING, retries=[0] * len(SLOWING))))
        assert "CPU / I/O" in text
        assert "NUM_GPUS = 1" in text


class TestParseArgs:
    def test_defaults_match_the_run_that_worked(self):
        args = parse_args([])
        assert args.max_length == 2048
        assert args.epochs == 3.0
        assert args.target_effective_batch == 4
        assert args.cpu is False and args.no_quantize is False

    def test_smoke_test_flags(self):
        args = parse_args(["--cpu", "--no-quantize", "--max-steps", "2"])
        assert args.cpu and args.no_quantize and args.max_steps == 2
