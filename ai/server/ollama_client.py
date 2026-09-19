"""
Thin wrapper around Ollama's local HTTP API (default http://127.0.0.1:11434,
loopback-only — nothing here is exposed off the machine). Not unit-tested
directly (it's an I/O boundary); exercised via manual checks once Ollama and
the models are actually running. Keep this file thin — anything testable
(chunking, retrieval, prompt assembly) lives in its own pure module instead.
"""
import os

import httpx

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
CHAT_MODEL = os.environ.get("CHAT_MODEL", "qwen3.5:4b")
EMBED_MODEL = os.environ.get("EMBED_MODEL", "nomic-embed-text")
REQUEST_TIMEOUT = httpx.Timeout(120.0)


async def embed(text: str) -> list[float]:
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        res = await client.post(f"{OLLAMA_URL}/api/embeddings", json={"model": EMBED_MODEL, "prompt": text})
        res.raise_for_status()
        return res.json()["embedding"]


async def chat(system_prompt: str, history: list[dict], message: str) -> str:
    messages = [{"role": "system", "content": system_prompt}, *history, {"role": "user", "content": message}]

    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        res = await client.post(
            f"{OLLAMA_URL}/api/chat",
            # think=False matters a lot here, not just for tidiness: measured live on this
            # machine (RTX 3050 4GB), the same trivial prompt took 73.7s with Qwen3.5's
            # default extended-thinking mode on vs 1.1s with it off (~65x) — thinking mode
            # generates a full internal reasoning trace before the actual reply, which this
            # app never shows the user anyway (only `message.content` is read below). Without
            # this, the chatbot is effectively unusable on constrained local hardware.
            json={"model": CHAT_MODEL, "messages": messages, "think": False, "stream": False},
        )
        res.raise_for_status()
        return res.json()["message"]["content"]
