# NISO AI - Yönetim Asistanı

NISO AI, İK politikaları, devam takibi (Text-to-SQL), şirket dokümantasyonu ve proje e-postaları için geliştirilmiş çok dilli (TR, EN, IT) yapay zeka yönetim asistanıdır.

## 🚀 Hızlı Başlatma

### 1. Tek Tıkla Başlatma (Önerilen)
Klasör içindeki **`start.bat`** dosyasına çift tıklayın veya PowerShell'de şunu çalıştırın:
```powershell
.\start.ps1
```
Bu script şunları otomatik olarak yapar:
1. Ollama yerel model sunucusunu başlatır (`qwen3.5:9b`).
2. Docker Desktop ve `management-postgres` + `n8n` konteynerlarını ayağa kaldırır.
3. Node.js Web UI & API sunucusunu (Port 3001) başlatır.
4. Tarayıcınızı `http://127.0.0.1:3001` adresinde otomatik açar.

### 2. Durdurma
```powershell
.\stop.ps1
```
veya `stop.bat` dosyasına çift tıklayabilirsiniz.

## 🌐 Servisler ve Portlar
- **Web UI & API:** [http://127.0.0.1:3001](http://127.0.0.1:3001)
- **n8n İş Akışları:** [http://127.0.0.1:5678](http://127.0.0.1:5678)
- **Ollama LLM:** [http://127.0.0.1:11434](http://127.0.0.1:11434)
- **PostgreSQL + pgvector:** `management-postgres` (Port 5432)
