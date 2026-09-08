# NISO AI - Assistant Guidelines & Project Architecture

## Project Overview
NISO Management Assistant is an enterprise AI assistant integrating:
- **Web UI & API Server**: Node.js HTTP server at `ui/server.js` listening on port `3001` (http://127.0.0.1:3001).
- **LLM Engine**: Local Ollama instance listening on port `11434` (http://127.0.0.1:11434) with models `qwen3.5:9b` and `qwen3-embedding:0.6b`.
- **Database**: PostgreSQL with pgvector inside Docker container `management-postgres`.
- **Workflow Automation**: n8n inside Docker container `n8n` listening on port `5678` (http://127.0.0.1:5678).

---

## How to Run / Start the Project
When the user asks to run the project ("projeyi çalıştır", "start project", etc.), follow this fast checklist:

1. **One-Command Fast Start**:
   Run `.\start.ps1` or `.\start.bat`.
   This script automatically:
   - Ensures Ollama is running (`ollama serve`).
   - Ensures Docker Desktop is started and containers `management-postgres` and `n8n` are active (`docker start management-postgres n8n`).
   - Ensures the Node.js server (`node ui/server.js`) is listening on port `3001`.
   - Opens `http://127.0.0.1:3001` in the browser.

2. **Manual Fast Verification**:
   - Check UI: `Invoke-WebRequest -Uri "http://127.0.0.1:3001/" -UseBasicParsing`
   - Check Ollama: `Get-Process ollama -ErrorAction SilentlyContinue`
   - Check Containers: `docker ps --filter "name=management-postgres" --filter "name=n8n"`
   - If UI server is not running:
     ```powershell
     Start-Process -FilePath "node" -ArgumentList "server.js" -WorkingDirectory "ui" -WindowStyle Hidden
     ```

## Key Files
- `ui/server.js`: Main backend API bridge and HTTP server for the frontend.
- `ui/index.html` & `ui/app.js`: Chat interface and client logic.
- `start.bat` / `start.ps1`: One-click startup scripts.
- `stop.bat` / `stop.ps1`: Stop scripts.
- `tools/`: Intent routing, text-to-SQL, RAG engines, and data indexing utilities.
