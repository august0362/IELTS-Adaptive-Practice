"""
Standalone LoRA training entrypoint for the Kaggle notebook (Milestone 7).

Launched as a SEPARATE PROCESS by the notebook —
`python -m torch.distributed.run --standalone --nproc_per_node=N lora_train_script.py ...`
— instead of in-kernel via `accelerate.notebook_launcher` (the earlier 2-GPU
attempt). Three reasons, all from real Kaggle runs (see AI_TASKS.md):

  1. Output isolation. The 8-bit path prints a `MatMul8bitLt: inputs will be
     cast...` warning per layer per step; four Python-level suppression
     attempts failed and the flood coincided with a severe, worsening
     slowdown. A child process writes to a pipe the notebook filters
     (kaggle_process_runner.py), so the notebook's own output never floods.
  2. Real diagnosis. Each rank appends per-step wall time, GPU memory,
     allocator retries and `nvidia-smi` clocks/throttle state to
     train_metrics_rank<N>.jsonl, so a slowdown can be attributed to memory
     thrash / GPU throttling / neither instead of guessed at. `diagnose()`
     turns those records into a plain-language verdict.
  3. Cleaner multi-GPU launch. `torchrun` kills every rank if one dies (no
     silent hang) and needs no "nothing may touch CUDA before launch" rule.

Config fixes verified against the installed sources (transformers 5.17.0,
peft 0.21.0, trl 1.13.0), not assumed:
  - `ddp_find_unused_parameters=False`. transformers' Trainer
    (`_build_accelerator_args`) only turns this off automatically for a
    `PreTrainedModel`; our model is a `PeftModel`, so it silently fell into
    the `else: find_unused = True` branch — DDP re-walked the autograd graph
    every step. The earlier 2-GPU run never set it.
  - `ddp_broadcast_buffers=False`: weights are identical on every rank, so
    there is nothing to sync (LoRA has no batch-norm-style buffers).
  - NCCL P2P/IB disabled: Kaggle's 2xT4 have no NVLink; only ~84MB of LoRA
    gradients cross per optimizer step, so the shared-memory path costs
    nothing while avoiding known P2P hangs on that machine type.

Kept deliberately unchanged from the run that DID work (single GPU, 8-bit,
adamw_torch, max_length 2048, `all-linear` LoRA): model, quantization, LoRA
and optimizer settings — only the parallelism/launch/logging changed.

Heavy imports (torch/transformers/peft/trl) happen inside main() so the pure
helpers here can be unit-tested with no GPU stack installed.
"""
import argparse
import importlib.metadata
import json
import os
import statistics
import subprocess
import sys
import time
import traceback

MODEL_NAME = "Qwen/Qwen3.5-4B"

# Substring of the per-layer 8-bit warning that floods the output. Kept narrow
# on purpose: a real error that merely mentions the class name must NOT be hidden.
NOISE_SUBSTRINGS = ("MatMul8bitLt: inputs will be cast",)

_GPU_QUERY_FIELDS = ("utilization.gpu", "temperature.gpu", "power.draw", "clocks.sm", "clocks.max.sm")

# NVML clocks-throttle-reason bitmask (see `nvidia-smi -q -d PERFORMANCE`).
_THROTTLE_BITS = {
    0x1: "gpu_idle",
    0x2: "applications_clocks_setting",
    0x4: "sw_power_cap",
    0x8: "hw_slowdown",
    0x10: "sync_boost",
    0x20: "sw_thermal_slowdown",
    0x40: "hw_thermal_slowdown",
    0x80: "hw_power_brake_slowdown",
    0x100: "display_clocks_setting",
}
# The others (idle / app clocks / sync boost / display) are benign and not a slowdown cause.
HARMFUL_THROTTLE = frozenset({"sw_power_cap", "hw_slowdown", "sw_thermal_slowdown", "hw_thermal_slowdown", "hw_power_brake_slowdown"})

# Field name changed between driver generations; try the newer one first.
_THROTTLE_QUERY_FIELDS = ("clocks_event_reasons.active", "clocks_throttle_reasons.active")

_LIBRARIES_TO_LOG = ("torch", "transformers", "peft", "trl", "accelerate", "bitsandbytes", "datasets")


# ---------------------------------------------------------------- pure helpers


def grad_accum_steps(world_size: int, per_device_batch: int = 1, target_effective_batch: int = 4) -> int:
    """Accumulation steps that keep the effective batch (per_device * world_size * accum) at the
    target regardless of GPU count — 1 GPU -> 4, 2 GPUs -> 2 — so the two modes train alike."""
    if world_size < 1 or per_device_batch < 1 or target_effective_batch < 1:
        raise ValueError("world_size, per_device_batch and target_effective_batch must all be >= 1")
    return max(1, target_effective_batch // (per_device_batch * world_size))


def build_launch_command(num_gpus: int, script_path: str, script_args: list[str] | None = None) -> list[str]:
    """`--standalone` = single-node rendezvous on a free localhost port (no manual port to collide)."""
    if num_gpus < 1:
        raise ValueError("num_gpus must be >= 1")
    return [
        sys.executable,
        "-m",
        "torch.distributed.run",
        "--standalone",
        f"--nproc_per_node={num_gpus}",
        script_path,
        *(script_args or []),
    ]


def build_child_env(base_env) -> dict[str, str]:
    """Environment for the training process. `setdefault` so a value the caller already chose wins."""
    env = dict(base_env)
    env.setdefault("NCCL_P2P_DISABLE", "1")
    env.setdefault("NCCL_IB_DISABLE", "1")
    # Fights allocator fragmentation (a leading suspect for the worsening slowdown, still unconfirmed).
    env.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")
    env.setdefault("TOKENIZERS_PARALLELISM", "false")
    env.setdefault("OMP_NUM_THREADS", "1")
    env["PYTHONUNBUFFERED"] = "1"
    env["PYTHONIOENCODING"] = "utf-8"
    return env


def decode_throttle_reasons(value) -> list[str]:
    """Bitmask (int, or hex string as nvidia-smi prints it, e.g. '0x0000000000000004') -> reason names."""
    if isinstance(value, str):
        text = value.strip()
        try:
            value = int(text, 16) if text.lower().startswith("0x") else int(text)
        except ValueError:
            return []
    if not isinstance(value, int):
        return []
    return [name for bit, name in sorted(_THROTTLE_BITS.items()) if value & bit]


def _to_number(raw: str):
    text = raw.strip()
    if text.startswith("[") or text == "":  # "[N/A]", "[Not Supported]"
        return None
    try:
        return float(text)
    except ValueError:
        return text


def parse_nvidia_smi_csv(text: str, fields) -> dict:
    """One `--format=csv,noheader,nounits` line -> {field: number|None}. {} if the shape is unexpected."""
    stripped = text.strip()
    if not stripped:
        return {}
    parts = [p.strip() for p in stripped.splitlines()[0].split(",")]
    if len(parts) != len(fields):
        return {}
    return {name: _to_number(raw) for name, raw in zip(fields, parts)}


def summarize_step_times(step_seconds: list[float], window: int = 5, slow_ratio: float = 2.0) -> dict:
    """Median of the first `window` steps AFTER step 1 (step 1 pays CUDA/kernel warm-up) vs the last `window`."""
    n = len(step_seconds)
    if n < 2 * window + 1:
        return {"steps": n, "enough_data": False}
    first = statistics.median(step_seconds[1 : 1 + window])
    last = statistics.median(step_seconds[-window:])
    ratio = last / first if first > 0 else float("inf")
    return {
        "steps": n,
        "enough_data": True,
        "first_median_s": round(first, 2),
        "last_median_s": round(last, 2),
        "ratio": round(ratio, 2),
        "progressive_slowdown": ratio >= slow_ratio,
    }


def diagnose(records: list[dict]) -> list[str]:
    """Plain-language verdict from ONE rank's metric records (the `event == "step"` ones)."""
    steps = [r for r in records if r.get("event") == "step" and "step_seconds" in r]
    if not steps:
        return ["Không có bản ghi bước train nào — train chưa chạy được tới bước đầu tiên."]

    summary = summarize_step_times([r["step_seconds"] for r in steps])
    if not summary["enough_data"]:
        return [f"Mới có {summary['steps']} bước — chưa đủ (cần ≥ 11) để kết luận có chậm dần hay không."]

    lines = [
        f"Thời gian mỗi bước: {summary['first_median_s']}s (đầu) → {summary['last_median_s']}s (cuối), "
        f"tỉ lệ {summary['ratio']}x."
    ]
    if not summary["progressive_slowdown"]:
        lines.append("Không thấy chậm dần bất thường.")
        return lines

    lines.append("CÓ chậm dần bất thường. Nguyên nhân khả dĩ, theo số đo thật:")
    retries = [r.get("alloc_retries", 0) for r in steps]
    retry_growth = retries[-1] - retries[0]
    if retry_growth > 0:
        lines.append(
            f"- Bộ nhớ GPU: bộ cấp phát phải thử lại {retry_growth} lần trong lúc train "
            "(dấu hiệu VRAM gần đầy/phân mảnh) → giảm max_length."
        )
    throttled = sorted(
        {reason for r in steps for reason in (r.get("gpu") or {}).get("throttle_reasons", []) if reason in HARMFUL_THROTTLE}
    )
    if throttled:
        lines.append(f"- GPU bị giảm xung: {', '.join(throttled)} (nhiệt/điện) — không sửa được từ phía code.")
    if retry_growth <= 0 and not throttled:
        lines.append(
            "- Không do bộ nhớ GPU cũng không do giảm xung → nghi nghẽn ở CPU / I/O / đồng bộ 2 GPU. "
            "Thử NUM_GPUS = 1 để loại trừ 2 GPU, và gửi train.log."
        )
    return lines


def library_versions() -> dict[str, str]:
    versions = {}
    for name in _LIBRARIES_TO_LOG:
        try:
            versions[name] = importlib.metadata.version(name)
        except importlib.metadata.PackageNotFoundError:
            versions[name] = "not installed"
    return versions


# --------------------------------------------------------------- GPU (I/O) helper


def query_gpu(index: int, timeout: float = 10.0) -> dict:
    """nvidia-smi snapshot for one GPU (utilisation, temperature, power, SM clocks, throttle reasons).
    Never raises — diagnostics must not be able to break training. {} when nvidia-smi is unavailable."""
    base = ["nvidia-smi", f"--id={index}", "--format=csv,noheader,nounits"]
    try:
        result = subprocess.run(
            [*base, f"--query-gpu={','.join(_GPU_QUERY_FIELDS)}"], capture_output=True, text=True, timeout=timeout
        )
        if result.returncode != 0:
            return {}
        info = parse_nvidia_smi_csv(result.stdout, _GPU_QUERY_FIELDS)
        for field in _THROTTLE_QUERY_FIELDS:
            reasons = subprocess.run([*base, f"--query-gpu={field}"], capture_output=True, text=True, timeout=timeout)
            if reasons.returncode == 0 and reasons.stdout.strip():
                info["throttle_reasons"] = decode_throttle_reasons(reasons.stdout.strip().splitlines()[0])
                break
        return info
    except (OSError, subprocess.SubprocessError):
        return {}


# ------------------------------------------------------------------ training main


def _load_data_helpers():
    try:
        from lora_training_data import load_training_examples, split_train_eval  # notebook: written next to this script
    except ImportError:
        from training.lora_training_data import load_training_examples, split_train_eval  # repo layout
    return load_training_examples, split_train_eval


def _make_step_metrics_callback(metrics_path: str, rank: int, world_size: int, local_rank: int, query_every: int = 5):
    import torch
    from transformers import TrainerCallback

    class StepMetricsCallback(TrainerCallback):
        def __init__(self):
            self._last = time.time()
            self._recent = []

        def _write(self, record: dict) -> None:
            with open(metrics_path, "a", encoding="utf-8") as f:
                f.write(json.dumps(record, ensure_ascii=False) + "\n")

        def on_train_begin(self, args, state, control, **kwargs):
            self._last = time.time()
            self._write(
                {
                    "event": "train_begin",
                    "rank": rank,
                    "world_size": world_size,
                    "max_steps": state.max_steps,
                    "versions": library_versions(),
                    "gpu": query_gpu(local_rank),
                }
            )

        def on_step_end(self, args, state, control, **kwargs):
            now = time.time()
            seconds = now - self._last
            self._last = now
            record = {"event": "step", "rank": rank, "step": state.global_step, "max_steps": state.max_steps}
            record["step_seconds"] = round(seconds, 2)
            if torch.cuda.is_available():
                stats = torch.cuda.memory_stats()
                record["mem_allocated_gb"] = round(torch.cuda.memory_allocated() / 1e9, 2)
                record["mem_reserved_gb"] = round(torch.cuda.memory_reserved() / 1e9, 2)
                record["mem_peak_gb"] = round(torch.cuda.max_memory_allocated() / 1e9, 2)
                record["alloc_retries"] = int(stats.get("num_alloc_retries", 0))
                if state.global_step % query_every == 0 or state.global_step == 1:
                    record["gpu"] = query_gpu(local_rank)
            self._write(record)

            self._recent = (self._recent + [seconds])[-5:]
            if rank == 0:
                remaining = max(0, state.max_steps - state.global_step)
                eta_min = statistics.median(self._recent) * remaining / 60
                print(
                    f"[bước {state.global_step}/{state.max_steps}] {seconds:.1f}s/bước | "
                    f"VRAM {record.get('mem_reserved_gb', 0)}GB | thử-lại-cấp-phát {record.get('alloc_retries', 0)} | "
                    f"còn ~{eta_min:.0f} phút",
                    flush=True,
                )

    return StepMetricsCallback()


def parse_args(argv=None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[1] if __doc__ else "")
    parser.add_argument("--data", default="training_data.jsonl")
    parser.add_argument("--output-dir", default="lora_adapter")
    parser.add_argument("--metrics-dir", default=".")
    parser.add_argument("--model", default=MODEL_NAME)
    parser.add_argument("--max-length", type=int, default=2048)
    parser.add_argument("--epochs", type=float, default=3.0)
    parser.add_argument("--target-effective-batch", type=int, default=4)
    parser.add_argument("--max-steps", type=int, default=-1, help="cap for smoke tests; -1 = full run")
    parser.add_argument("--no-quantize", action="store_true", help="skip 8-bit (CPU smoke test only)")
    parser.add_argument("--cpu", action="store_true", help="CPU smoke test: no CUDA")
    return parser.parse_args(argv)


def main(argv=None) -> None:
    args = parse_args(argv)
    rank = int(os.environ.get("RANK", "0"))
    local_rank = int(os.environ.get("LOCAL_RANK", "0"))
    world_size = int(os.environ.get("WORLD_SIZE", "1"))

    import torch
    from datasets import Dataset
    from peft import LoraConfig, TaskType, get_peft_model, prepare_model_for_kbit_training
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
    from trl import SFTConfig, SFTTrainer

    use_cuda = torch.cuda.is_available() and not args.cpu
    if use_cuda:
        torch.cuda.set_device(local_rank)

    load_training_examples, split_train_eval = _load_data_helpers()
    train_examples, _eval_examples = split_train_eval(load_training_examples(args.data), eval_fraction=0.1, seed=7)
    if rank == 0:
        print(f"{len(train_examples)} mẫu train, {world_size} tiến trình/GPU", flush=True)

    tokenizer = AutoTokenizer.from_pretrained(args.model)

    if args.no_quantize:
        model = AutoModelForCausalLM.from_pretrained(args.model, dtype=torch.float32 if args.cpu else torch.bfloat16)
    else:
        model = AutoModelForCausalLM.from_pretrained(
            args.model,
            quantization_config=BitsAndBytesConfig(load_in_8bit=True),  # 8-bit, NOT 4-bit/QLoRA (AI_CHATBOT_PLAN.md s.5)
            dtype=torch.bfloat16,  # dtype of the parts that are NOT quantized
            device_map={"": local_rank},  # each rank owns its GPU (TRL's own multi-GPU k-bit recipe)
        )
        model = prepare_model_for_kbit_training(model)

    model = get_peft_model(
        model,
        LoraConfig(
            r=16,
            lora_alpha=16,
            lora_dropout=0.0,
            bias="none",
            target_modules="all-linear",  # also covers GatedDeltaNet's own proj names (in_proj_qkv...)
            task_type=TaskType.CAUSAL_LM,
        ),
    )
    if rank == 0:
        model.print_trainable_parameters()

    sft_config = SFTConfig(
        output_dir="lora_adapter_output",
        num_train_epochs=args.epochs,
        max_steps=args.max_steps,
        per_device_train_batch_size=1,
        gradient_accumulation_steps=grad_accum_steps(world_size, 1, args.target_effective_batch),
        learning_rate=2e-4,
        warmup_steps=5,
        optim="adamw_torch",
        weight_decay=0.0,
        max_length=args.max_length,
        assistant_only_loss=True,
        packing=False,
        bf16=False,
        fp16=False,
        gradient_checkpointing=True,
        gradient_checkpointing_kwargs={"use_reentrant": False},
        ddp_find_unused_parameters=False,
        ddp_broadcast_buffers=False,
        use_cpu=args.cpu,
        logging_steps=1,
        disable_tqdm=True,
        save_strategy="epoch",
        save_only_model=True,
        report_to="none",
        seed=7,
    )

    trainer = SFTTrainer(
        model=model,
        args=sft_config,
        train_dataset=Dataset.from_list(train_examples),
        processing_class=tokenizer,
        callbacks=[
            _make_step_metrics_callback(
                os.path.join(args.metrics_dir, f"train_metrics_rank{rank}.jsonl"), rank, world_size, local_rank
            )
        ],
    )
    trainer.train()

    trainer.save_model(args.output_dir)  # collective: every rank calls it, only rank 0 writes
    if rank == 0:
        tokenizer.save_pretrained(args.output_dir)
        print(f"Đã lưu adapter vào {args.output_dir}", flush=True)

    if torch.distributed.is_available() and torch.distributed.is_initialized():
        torch.distributed.destroy_process_group()


if __name__ == "__main__":
    try:
        main()
    except BaseException:
        print(f"[rank {os.environ.get('RANK', '0')}] TRAINING FAILED:\n{traceback.format_exc()}", flush=True)
        raise
