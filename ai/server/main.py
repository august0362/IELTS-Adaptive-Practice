"""
Inference server for the chatbot — a separate module from web/'s Next.js app
(see PROJECT_CONTEXT.md section 11.1: no shared imports, HTTP only). web/'s
POST /api/chat is the only caller; nothing here ever reads web/'s database
directly — the caller passes whatever DB context it wants considered in the
`dbContext` field.

Run from ai/:  uvicorn server.main:app --host 127.0.0.1 --port 8787
"""
import json
from pathlib import Path

import numpy as np
from fastapi import FastAPI
from pydantic import BaseModel

from . import ollama_client
from .prompt import build_system_prompt
from .retrieval import top_k

app = FastAPI()

INDEX_PATH = Path(__file__).resolve().parents[1] / "data" / "processed" / "doc_index.json"
TOP_K = 4


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []
    dbContext: str = ""


class ChatResponseBody(BaseModel):
    reply: str


def load_index() -> list[dict]:
    """Empty list (not an error) when the index hasn't been built yet via
    build_index.py — the chatbot still answers, just without doc grounding."""
    if not INDEX_PATH.exists():
        return []
    return json.loads(INDEX_PATH.read_text(encoding="utf-8"))


@app.post("/chat", response_model=ChatResponseBody)
async def chat(req: ChatRequest) -> ChatResponseBody:
    index = load_index()

    retrieved = []
    if index:
        query_embedding = await ollama_client.embed(req.message)
        retrieved = top_k(np.array(query_embedding), index, k=TOP_K)

    system_prompt = build_system_prompt(retrieved, req.dbContext)
    history = [m.model_dump() for m in req.history]
    reply = await ollama_client.chat(system_prompt, history, req.message)

    return ChatResponseBody(reply=reply)


@app.get("/health")
async def health() -> dict:
    return {"ok": True, "indexed_chunks": len(load_index())}
