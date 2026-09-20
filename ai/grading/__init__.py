"""
Pure, model-free logic for the Writing/Speaking grader (Milestone 8 — see
AI_CHATBOT_PLAN.md section 13). Nothing in this package does I/O or calls a
model: everything here is unit-testable with no GPU, no Ollama and no Whisper —
the same split as ai/server/, where prompt.py/retrieval.py/chunking.py are pure
and ollama_client.py is the one thin I/O boundary.
"""
