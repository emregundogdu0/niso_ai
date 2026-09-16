# NISO AI — Yönetim Asistanı

NISO AI, şirket içi yönetim sorularını doğal dilde alan, niyetine göre doğru veri kaynağına yönlendiren ve **kaynaklı** cevap üreten yerel bir yapay zekâ asistanıdır.

Desteklenen diller: **Türkçe (TR)**, **English (EN)**, **Italiano (IT)**.

Veriler ve model çağrıları yerel ortamda kalır; cevaplar harici bulut LLM API’sine gönderilmez.

---

## Ne yapabilir?

| Yetenek | Ne sorulur? | Nasıl cevaplanır? |
|---|---|---|
| **İK politikaları** | Çalışma saatleri, izin, dress code, yan haklar | CAG snapshot + RAG (pgvector) / lexical fallback |
| **Devam / puantaj** | Bugün kim geç kaldı, giriş saati, ortalama gecikme | Secure Text-to-SQL → PostgreSQL |
| **Proje e-postası** | Son mail, proje durumu, tarihli mail özeti | Mail ingestion + semantik RAG |
| **Kurumsal bilgi** | Şirket / ürün / teknoloji soruları | Company knowledge RAG |
| **Doküman OCR** | Yüklenen PDF/görsel içeriği | OCR + yapılandırma + pgvector arama |
| **Hibrit analiz** | Devam + proje bilgisini birlikte isteyen sorular | Multi-source evidence merger |
| **Yardım / small talk** | Selamlaşma, yetenek listesi | Deterministik local yanıt |

Ek özellikler:
- F1 güven skoru (benchmark kalibrasyonlu)
- LLM-as-a-judge (halüsinasyon / sadakat kontrolü)
- Sesli giriş / TTS (ayrıntılar: [`VOICE_TTS_SETUP.md`](VOICE_TTS_SETUP.md))

---

## Mimari — nasıl çalışır?

```text
Kullanıcı (Web UI :3001)
        │
        ▼
  /api/chat  (ui/server.js)
        │
        ├─ Pre-Router Guard          → güvenlik, dil, small-talk, HR/SQL/mail niyeti
        │                              (deterministic keyword + kurallar)
        │
        ├─ LLM Intent Fallback       → belirsiz sorularda Ollama sınıflandırma
        │
        ├─ HR Hybrid CAG/RAG         → embedding + politika chunk’ları (+ lexical fallback)
        ├─ Secure Text-to-SQL        → kontrollü SQL üretimi / çalıştırma
        ├─ Project Mail RAG          → indekslenmiş e-postalar
        ├─ Company Knowledge RAG     → kurumsal bilgi
        ├─ Document OCR Search       → yüklenen belgeler
        └─ Hybrid Merger             → çok kaynaklı birleştirme
        │
        ▼
  F1 skoru + Judge değerlendirme + audit log
        │
        ▼
  JSON yanıt (title, answer, sources, confidence)
```

### Tipik istek akışı

1. Kullanıcı mesaj yazar.
2. **Pre-router** niyeti belirler (`HR_POLICY`, `ATTENDANCE_SQL`, `PROJECT_MAIL`, …).
3. İlgili motor yalnızca kendi kanıt setinden cevap üretir.
4. Yanıta kaynak listesi, F1 ve (mümkünse) judge skoru eklenir.
5. İstek `audit.chat_request` tablosuna loglanır.

### Kullanılan modeller (Ollama)

| Model | Rol |
|---|---|
| `qwen3.5:9b` | Niyet, cevap üretimi, judge |
| `qwen3-embedding:0.6b` | Semantik arama (embedding) |

> Not: Her cevapta birden fazla Ollama çağrısı olabilir (embedding + generate + judge). Bu yüzden ilk yanıtlar veya GPU/CPU yükü altında gecikme artabilir.

---

## Hızlı başlatma

### Önkoşullar

- Windows 10/11
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Ollama](https://ollama.com/) + modeller:
  ```powershell
  ollama pull qwen3.5:9b
  ollama pull qwen3-embedding:0.6b
  ```
- Node.js 18+ (UI sunucusu için)

### Tek tıkla başlatma (önerilen)

```powershell
.\start.ps1
```

veya `start.bat` dosyasına çift tıklayın.

Script sırasıyla:
1. Ollama’yı ayağa kaldırır (`http://127.0.0.1:11434`)
2. Docker’da `management-postgres` + `n8n` konteynerlarını kontrol eder / başlatır
3. Node Web UI & API’yi **port 3001**’de başlatır
4. Tarayıcıda `http://127.0.0.1:3001` açar

### Durdurma

```powershell
.\stop.ps1
```

veya `stop.bat`.

### Manuel UI başlatma

```powershell
cd ui
node server.js
```

Varsayılan adres: **http://127.0.0.1:3001**

---

## Servisler ve portlar

| Servis | Adres | Açıklama |
|---|---|---|
| Web UI & API | http://127.0.0.1:3001 | Sohbet arayüzü + `/api/chat` |
| n8n | http://127.0.0.1:5678 | İş akışları / orchestration |
| Ollama | http://127.0.0.1:11434 | Yerel LLM + embedding |
| PostgreSQL + pgvector | `management-postgres` :5432 | Politikalar, RAG, audit, puantaj |

---

## Proje yapısı

```text
NISO_AI/
├── ui/                      # Web arayüz + HTTP API (server.js, app.js, style.css)
├── tools/                   # Motorlar: router, HR RAG, SQL, mail, OCR, judge, F1
├── benchmark/               # Ground-truth F1 benchmark veri seti
├── n8n_*.json               # n8n workflow export’ları
├── hr_policy_dataset_100.jsonl
├── start.ps1 / stop.ps1
├── VOICE_TTS_SETUP.md
├── TEST_PLAN_NISO_AI.md
└── README.md
```

### Önemli motor dosyaları

| Dosya | Görev |
|---|---|
| `tools/pre_router_guard.js` | Deterministik niyet / dil / güvenlik |
| `tools/hr_hybrid_cag_rag_engine.js` | İK CAG+RAG (+ Ollama yoksa lexical fallback) |
| `tools/secure_text_to_sql_engine.js` | Puantaj Text-to-SQL |
| `tools/project_mail_rag_engine.js` | Proje mail RAG |
| `tools/document_ocr_pipeline.js` | Doküman yükleme / OCR / indeks |
| `tools/llm_as_a_judge.js` | Cevap kalite / halüsinasyon kontrolü |
| `tools/f1_confidence_calculator.js` | Empirik F1 güven skoru |
| `ui/server.js` | Ana orkestrasyon API |

---

## API özeti

### `POST /api/chat`

```json
{
  "message": "dress code nedir şirkette",
  "session_id": "demo_session_1"
}
```

Örnek yanıt alanları:
- `intent` — örn. `HR_POLICY`
- `title` / `answer` — kullanıcıya gösterilen içerik
- `sources` — kanıt kaynakları
- `f1_percent` / `judge_evaluation` — güven ve doğrulama
- `request_id` / `audit_id` — izlenebilirlik

---

## n8n iş akışları

Repodaki `n8n_*.json` dosyaları pipeline adımlarını temsil eder (sağlık kontrolü, HR dataset load, embedding index, CAG snapshot, intent router, mail ingestion, global error handler vb.).

n8n UI: http://127.0.0.1:5678

> Günlük sohbet için birincil yol Node UI (`ui/server.js`) üzerindendir; n8n orchestration ve veri hazırlığı için kullanılır.

---

## Test ve kalite

- Test planı: [`TEST_PLAN_NISO_AI.md`](TEST_PLAN_NISO_AI.md)
- Çalıştırma raporu: [`TEST_EXECUTION_REPORT_NISO_AI.md`](TEST_EXECUTION_REPORT_NISO_AI.md)
- Benchmark: `benchmark/niso_f1_benchmark.json`
- Router / HR / mail suite’leri: `tools/test_*.js`

Örnek:

```powershell
node tools/test_router_and_smalltalk_suite.js
node tools/test_hr_answer_suite.js
```

---

## Sorun giderme

### UI açılmıyor
- `http://127.0.0.1:3001` dinleniyor mu kontrol edin.
- `cd ui; node server.js` ile yeniden başlatın.
- Docker Desktop’ın açık olduğundan emin olun.

### Cevaplar çok yavaş
Her istekte embedding + LLM generate + judge zinciri çalışabilir. Kontrol listesi:
1. Ollama ayakta mı? → http://127.0.0.1:11434
2. GPU yerine CPU’da mı koşuyor?
3. Bellekte birden fazla büyük model yüklü mü? (`ollama ps`)
4. Aynı anda başka ağır süreç var mı?

### İK soruları hata veriyor / “Sistem Uyarısı”
- Postgres konteyneri (`management-postgres`) healthy mi?
- Ollama kapalıysa HR motoru lexical fallback’e düşer; yine de DB erişimi gerekir.
- `dresscode` / `dress code` gibi varyantlar `HR_POLICY` olarak route edilir.

### n8n erişilemiyor
- Konteynerin ayakta olduğunu doğrulayın: `docker ps`
- Port: **5678**

---

## Güvenlik notları

- Tehlikeli SQL / prompt-injection kalıpları pre-router güvenlik katmanında reddedilir.
- Text-to-SQL katmanı kontrollü şema ve sorgu üretimi kullanır.
- Hassas şirket verisi için sistemin yerel (air-gapped / intranet) çalışması tasarımın parçasıdır.

---

## Lisans / kullanım

Bu depo kurum içi yönetim asistanı demo ve geliştirme amaçlıdır. İK politika veri setinin bir kısmı **sentetik demo** kayıtları içerir; üretim politikası olarak doğrudan kullanılmamalıdır.
