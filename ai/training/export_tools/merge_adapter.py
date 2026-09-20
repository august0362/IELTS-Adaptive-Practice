import sys
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

MODEL_NAME = "Qwen/Qwen3.5-4B"
ADAPTER_DIR = r"C:\Users\admin\Desktop\File All\Demo project\Project\EL\ai\training\output"
MERGED_DIR = r"C:\Users\admin\Desktop\File All\Demo project\Project\EL\ai\training\output\merged"

print("Loading base model (this downloads ~9.3GB if not cached)...", flush=True)
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
base_model = AutoModelForCausalLM.from_pretrained(MODEL_NAME, dtype=torch.bfloat16)
print("Base model loaded. Loading LoRA adapter (full, including out_proj)...", flush=True)

peft_model = PeftModel.from_pretrained(base_model, ADAPTER_DIR)
print("Merging adapter into base weights...", flush=True)
merged = peft_model.merge_and_unload()

print(f"Saving merged model to {MERGED_DIR} ...", flush=True)
merged.save_pretrained(MERGED_DIR, safe_serialization=True)
tokenizer.save_pretrained(MERGED_DIR)
print("Done.", flush=True)
