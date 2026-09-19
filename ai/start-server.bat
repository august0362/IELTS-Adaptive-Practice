@echo off
setlocal

rem Always run from this script's own folder, no matter where it's double-clicked from.
cd /d "%~dp0"

echo ================================================
echo   Chatbot AI - dang khoi dong server...
echo ================================================
echo.

where ollama >nul 2>nul
if errorlevel 1 (
    echo Loi: chua cai Ollama. Cai tai https://ollama.com roi thu lai.
    pause
    exit /b 1
)

if not exist ".venv" (
    echo [1/3] Chua co moi truong Python, dang tao va cai dependencies ...
    python -m venv .venv
    call .venv\Scripts\pip install -r requirements.txt
) else (
    echo [1/3] Moi truong Python da san sang.
)

if not exist "data\processed\doc_index.json" (
    echo [2/3] Chua co chi muc RAG, dang dung ollama pull + build_index ...
    ollama pull qwen3.5:4b
    ollama pull nomic-embed-text
    call .venv\Scripts\python -m server.build_index
) else (
    echo [2/3] Chi muc RAG da san sang. Neu PROJECT_CONTEXT.md/USER_GUIDE.md/document.txt
    echo       vua doi, xoa data\processed\doc_index.json roi chay lai script nay de cap nhat.
)

echo [3/3] Dang khoi dong server (cong 8787) ...
echo.
echo Server nay phai chay CUNG LUC voi web app (start-app.bat o thu muc goc)
echo de trang /chat hoat dong duoc. Dong cua so nay (hoac bam Ctrl+C) de tat.
echo.

call .venv\Scripts\uvicorn server.main:app --host 127.0.0.1 --port 8787

pause
