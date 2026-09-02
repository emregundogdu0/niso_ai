/**
 * NISO Management Assistant — Local HTTP Web Server & API Bridge
 * Multilingual Engine: TR, EN, IT
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const { preRouteGuard, detectLanguageDeterministic } = require('../tools/pre_router_guard');
const { executeSecureTextToSql } = require('../tools/secure_text_to_sql_engine');
const { answerProjectMailQuery } = require('../tools/project_mail_rag_engine');
const { answerCompanyKnowledgeQuestion } = require('../tools/company_knowledge_rag_engine');
const { processHybridQuery } = require('../tools/hybrid_evidence_merger');
const { handleGlobalError } = require('../tools/global_error_handler');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Session Language Memory
const sessionLanguageMap = new Map();

// Rate Limiter
const rateLimitMap = new Map();
function checkRateLimit(sessionId) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxReq = 60;

  let record = rateLimitMap.get(sessionId);
  if (!record) {
    rateLimitMap.set(sessionId, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (now > record.resetAt) {
    record.count = 1;
    record.resetAt = now + windowMs;
    return true;
  }

  record.count++;
  return record.count <= maxReq;
}

function runAdminPsql(sqlQuery) {
  try {
    return execSync('docker exec -i management-postgres psql -U management_admin -d management_ai -q -X', {
      input: Buffer.from(sqlQuery, 'utf8'),
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024
    });
  } catch (e) {
    return '';
  }
}

function runAdminPsqlJson(sqlQuery) {
  try {
    const cleanQuery = sqlQuery.trim().replace(/;+$/, '');
    const jsonWrapped = `\\t\n\\a\nSELECT json_agg(t) FROM (${cleanQuery}) t;`;
    const result = execSync('docker exec -i management-postgres psql -U management_admin -d management_ai -q -X', {
      input: Buffer.from(jsonWrapped, 'utf8'),
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024
    });
    const trimmed = result.trim();
    if (!trimmed || trimmed === 'null') return [];
    return JSON.parse(trimmed);
  } catch (e) {
    return [];
  }
}

// Fallback LLM Classifier returning structured JSON with language & intent
async function queryLlmIntent(userMessage, lang = 'tr') {
  return new Promise((resolve) => {
    const promptText = `You are a multilingual intent & language classifier for an enterprise management assistant.
Analyze the user message and respond ONLY with a single JSON object in the exact format:
{
  "language": "tr|en|it|other",
  "iso_code": "tr|en|it",
  "confidence": 0.95,
  "intent": "SMALL_TALK|HR_POLICY|ATTENDANCE_SQL|COMPANY_KNOWLEDGE|PROJECT_MAIL|HYBRID|UNKNOWN",
  "intent_confidence": 0.95
}

User message: "${userMessage.replace(/"/g, '\\"')}"

JSON:`;

    const data = JSON.stringify({
      model: 'qwen3.5:9b',
      prompt: promptText,
      stream: false,
      keep_alive: '30m',
      options: { temperature: 0.1, num_predict: 128 }
    });

    const req = http.request({
      hostname: '127.0.0.1',
      port: 11434,
      path: '/api/generate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(b);
          const raw = parsed.response || '';
          const match = raw.match(/\{[\s\S]*?\}/);
          if (match) {
            const j = JSON.parse(match[0]);
            resolve({
              language: j.iso_code || j.language || lang,
              language_confidence: typeof j.confidence === 'number' ? j.confidence : 0.85,
              intent: j.intent || 'UNKNOWN',
              intent_confidence: typeof j.intent_confidence === 'number' ? j.intent_confidence : 0.85
            });
            return;
          }
        } catch (e) {}
        resolve({ language: lang, language_confidence: 0.5, intent: 'UNKNOWN', intent_confidence: 0.0 });
      });
    });
    req.on('error', () => resolve({ language: lang, language_confidence: 0.5, intent: 'UNKNOWN', intent_confidence: 0.0 }));
    req.write(data);
    req.end();
  });
}

// Multilingual Canonical HR Policy Query
async function queryHrPolicyRag(question, lang = 'tr') {
  const q = question.toLowerCase();

  // 1. Working Hours Policy (HR-001)
  if (q.includes('saat') || q.includes('mesai') || q.includes('giris') || q.includes('çalışma') ||
      q.includes('working hours') || q.includes('work hours') || q.includes('office hours') ||
      q.includes('orari di lavoro') || q.includes('orario di lavoro') || q.includes('orari')) {
    let answer = '';
    if (lang === 'en') {
      answer = `### Working Hours Policy (HR-001)\n\n- **Standard Working Hours:** The standard weekly working time is 45 hours. Working hours for Headquarters and R&D departments are Monday to Friday **09:00 - 18:00**.\n- **Lunch Break:** A 1-hour break is scheduled between **12:30 - 13:30**.\n- **Flexible Arrival (HR-005):** For eligible roles agreed with managers, flexible arrival is allowed between 08:30 - 09:30.\n- **Core Hours (HR-037):** All employees must be at work or available during core hours **10:00 - 16:00**.\n\n*Note: Response provided from approved HR Policy (HR-001).*`;
    } else if (lang === 'it') {
      answer = `### Politica sugli Orari di Lavoro (HR-001)\n\n- **Orario di Lavoro Standard:** L'orario di lavoro settimanale è di 45 ore. Per la sede centrale e i reparti R&D l'orario di lavoro è dal lunedì al venerdì **09:00 - 18:00**.\n- **Pausa Pranzo:** È prevista una pausa di 1 ora tra le **12:30 e le 13:30**.\n- **Flessibilità in Entrata (HR-005):** Per i ruoli concordati con i responsabili, è consentita un'entrata flessibile tra le 08:30 e le 09:30.\n- **Ore Centrali (HR-037):** Tutti i dipendenti devono essere reperibili durante le ore centrali **10:00 - 16:00**.\n\n*Nota: Risposta fornita dalla politica aziendale HR approvata (HR-001).*`;
    } else {
      answer = `### Çalışma Saatleri Politikası (HR-001)\n\n- **Standart Çalışma Saatleri:** Şirketimizde haftalık çalışma süresi 45 saattir. Merkez ofis ve Ar-Ge birimleri için çalışma saatleri hafta içi (Pazartesi – Cuma) **09:00 - 18:00** arasındadır.\n- **Öğle Molası:** **12:30 - 13:30** saatleri arasında 1 saatlik mola uygulanır.\n- **Esnek Varış Penceresi (HR-005):** Yöneticisiyle mutabık kalınan pozisyonlar için 08:30 - 09:30 arası esnek giriş imkânı sağlanabilir.\n- **Çekirdek Saatler (HR-037):** Tüm çalışanların **10:00 - 16:00** çekirdek saatleri arasında görev başında veya erişilebilir olması esastır.\n\n*Not: Yanıt onaylı şirket İK politikaları (HR-001) üzerinden sağlanmıştır.*`;
    }

    return {
      answer: answer,
      sources: [
        {
          source_id: 'HR-001',
          provider: 'HR_POLICY',
          message_id: 'HR-001',
          thread_id: null,
          title: lang === 'en' ? 'Working Hours and Overtime Policy' : (lang === 'it' ? 'Politica su Orari di Lavoro e Straordinari' : 'Çalışma Saatleri ve Fazla Mesai Politikası'),
          sender: lang === 'en' ? 'Human Resources' : (lang === 'it' ? 'Risorse Umane' : 'İnsan Kaynakları'),
          received_at: null,
          project_code: null,
          data_mode: 'DEMO',
          is_synthetic: true
        }
      ]
    };
  }

  // 2. Maternity Leave Policy (HR-004)
  if (q.includes('dogum') || q.includes('maternity') || q.includes('maternita') || q.includes('congedo')) {
    let answer = '';
    if (lang === 'en') {
      answer = `### Maternity and Parental Leave Policy (HR-004)\n\n- **Paid Maternity Leave:** A total of **16 weeks** of paid maternity leave is provided (8 weeks before and 8 weeks after childbirth).\n- **Breastfeeding Allowance:** Female employees are entitled to **1.5 hours** of paid breastfeeding leave daily until the child reaches 1 year of age.\n- **Unpaid Leave:** Up to **6 months** of optional unpaid leave can be requested following statutory maternity leave.\n\n*Note: Applications must be submitted via the HR portal with relevant medical certificates.*`;
    } else if (lang === 'it') {
      answer = `### Politica sul Congedo di Maternità (HR-004)\n\n- **Congedo di Maternità Retribuito:** È previsto un totale di **16 settimane** di congedo retribuito (8 settimane prima e 8 settimane dopo il parto).\n- **Permesso Allattamento:** È concesso un permesso giornaliero retribuito di **1,5 ore** fino al compimento di 1 anno del bambino.\n- **Congedo Non Retribuito:** È possibile richiedere fino a **6 mesi** di congedo facoltativo non retribuito al termine della maternità obbligatoria.\n\n*Nota: Le richieste devono essere inviate tramite il portale HR con certificato medico.*`;
    } else {
      answer = `### Doğum ve Analık İzni Politikası (HR-004)\n\n- **Ücretli Doğum İzni:** Doğumdan önce 8 hafta ve doğumdan sonra 8 hafta olmak üzere toplam **16 hafta** yasal ücretli doğum izni sağlanır.\n- **Süt İzni:** Çocuğun 1 yaşına kadar günde **1,5 saat** ücretli süt izni verilir.\n- **Ücretsiz İzin:** Talep edilmesi hâlinde doğum izninin bitiminden itibaren **6 aya kadar** ücretsiz izin hakkı mevcuttur.\n\n*Not: Başvurular İK portalı üzerinden doğum öncesi rapor ile yapılmalıdır.*`;
    }

    return {
      answer: answer,
      sources: [
        {
          source_id: 'HR-004',
          provider: 'HR_POLICY',
          message_id: 'HR-004',
          thread_id: null,
          title: lang === 'en' ? 'Maternity and Parental Leave Procedure' : (lang === 'it' ? 'Procedura di Congedo di Maternità e Parentale' : 'Doğum ve Analık İzni Yönetmeliği'),
          sender: lang === 'en' ? 'Human Resources' : (lang === 'it' ? 'Risorse Umane' : 'İnsan Kaynakları'),
          received_at: null,
          project_code: null,
          data_mode: 'DEMO',
          is_synthetic: true
        }
      ]
    };
  }

  // 3. Annual Leave Policy (HR-003)
  if (q.includes('izin') || q.includes('yillik') || q.includes('leave') || q.includes('annual') || q.includes('ferie') || q.includes('vacation')) {
    let answer = '';
    if (lang === 'en') {
      answer = `### Annual Leave Entitlement Policy (HR-003)\n\n- **1 - 5 Years Tenure:** 14 working days\n- **5 - 15 Years Tenure:** 20 working days\n- **15+ Years Tenure:** 26 working days\n\n*Note: Leave requests must be submitted at least 3 business days in advance via the HR portal.*`;
    } else if (lang === 'it') {
      answer = `### Politica sulle Ferie Annuali (HR-003)\n\n- **1 - 5 Anni di Anzianità:** 14 giorni lavorativi\n- **5 - 15 Anni di Anzianità:** 20 giorni lavorativi\n- **Oltre 15 Anni di Anzianità:** 26 giorni lavorativi\n\n*Nota: Le richieste di ferie devono essere inviate almeno 3 giorni lavorativi prima tramite il portale HR.*`;
    } else {
      answer = `### Yıllık İzin Hak Ediş Politikası (HR-003)\n\n- **1 - 5 Yıl Kıdem:** 14 iş günü\n- **5 - 15 Yıl Kıdem:** 20 iş günü\n- **15 Yıl ve Üzeri:** 26 iş günü\n\n*Not: Yıllık izin talepleri en az 3 iş günü öncesinden İK portalı üzerinden onaya gönderilmelidir.*`;
    }

    return {
      answer: answer,
      sources: [
        {
          source_id: 'HR-003',
          provider: 'HR_POLICY',
          message_id: 'HR-003',
          thread_id: null,
          title: lang === 'en' ? 'Annual Leave Entitlement Procedure' : (lang === 'it' ? 'Regolamento Ferie e Permessi Annuali' : 'Yıllık ve Mazeret İzinleri Yönetmeliği'),
          sender: lang === 'en' ? 'Human Resources' : (lang === 'it' ? 'Risorse Umane' : 'İnsan Kaynakları'),
          received_at: null,
          project_code: null,
          data_mode: 'DEMO',
          is_synthetic: true
        }
      ]
    };
  }

  // 4. Dress Code (HR-012)
  if (q.includes('kiyafet') || q.includes('dress code') || q.includes('abbigliamento')) {
    let answer = '';
    if (lang === 'en') {
      answer = `### Dress Code Policy (HR-012)\n\n- **Monday – Thursday:** Smart Casual (Professional and comfortable business attire).\n- **Friday:** Casual Day.\n- **Production / Factory:** Occupational safety certified protective workwear and steel-toe safety shoes required.`;
    } else if (lang === 'it') {
      answer = `### Codice di Abbigliamento (HR-012)\n\n- **Lunedì – Giovedì:** Smart Casual (Abbigliamento professionale e confortevole).\n- **Venerdì:** Casual Day.\n- **Produzione / Fabbrica:** Obbligatorio l'uso di indumenti protettivi DPI e scarpe antinfortunistiche con punta in acciaio.`;
    } else {
      answer = `### Kıyafet Yönetmeliği (HR-012)\n\n- **Pazartesi – Perşembe:** Smart Casual (İş ortamına uygun rahat-şık giyim).\n- **Cuma:** Casual Day (Serbest giyim).\n- **Üretim / Fabrika:** İSG standartlarına uygun koruyucu kıyafet ve çelik burunlu ayakkabı giyilmesi zorunludur.`;
    }

    return {
      answer: answer,
      sources: [
        {
          source_id: 'HR-012',
          provider: 'HR_POLICY',
          message_id: 'HR-012',
          thread_id: null,
          title: lang === 'en' ? 'Corporate Conduct and Dress Code' : (lang === 'it' ? 'Codice di Condotta e Abbigliamento' : 'Şirket İçi Davranış ve Giyim Kuralları'),
          sender: lang === 'en' ? 'Human Resources' : (lang === 'it' ? 'Risorse Umane' : 'İnsan Kaynakları'),
          received_at: null,
          project_code: null,
          data_mode: 'DEMO',
          is_synthetic: true
        }
      ]
    };
  }

  // Fallback default
  let fallbackAns = '### Çalışma Saatleri Politikası (HR-001)\n\nMerkez ofis ve Ar-Ge birimleri standart mesai saatleri hafta içi **09:00 - 18:00** arasındadır (Öğle molası 12:30 - 13:30).';
  if (lang === 'en') fallbackAns = '### Working Hours Policy (HR-001)\n\nHeadquarters and R&D departments standard working hours are Monday to Friday **09:00 - 18:00** (Lunch break 12:30 - 13:30).';
  if (lang === 'it') fallbackAns = "### Politica sugli Orari di Lavoro (HR-001)\n\nL'orario standard per la sede centrale e i reparti R&D è dal lunedì al venerdì **09:00 - 18:00** (Pausa pranzo 12:30 - 13:30).";

  return {
    answer: fallbackAns,
    sources: [
      {
        source_id: 'HR-001',
        provider: 'HR_POLICY',
        message_id: 'HR-001',
        thread_id: null,
        title: lang === 'en' ? 'Working Hours Policy' : (lang === 'it' ? 'Politica sugli Orari di Lavoro' : 'Çalışma Saatleri Politikası'),
        sender: lang === 'en' ? 'Human Resources' : (lang === 'it' ? 'Risorse Umane' : 'İnsan Kaynakları'),
        received_at: null,
        project_code: null,
        data_mode: 'DEMO',
        is_synthetic: true
      }
    ]
  };
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', `*`);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Static File Serving
  if (req.method === 'GET') {
    let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }
    const ext = path.extname(filePath);
    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.ico': 'image/x-icon'
    };
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  // API Endpoints
  if (req.method === 'POST' && req.url === '/api/feedback') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const reqId = payload.request_id || 'unknown';
        const feedbackVal = payload.feedback || 'neutral';
        const auditSql = `
          UPDATE audit.chat_request 
          SET feedback_rating = '${feedbackVal.replace(/'/g, "''")}', 
              feedback_received_at = now()
          WHERE request_id = '${reqId.replace(/'/g, "''")}';
        `;
        runAdminPsql(auditSql);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'OK', request_id: reqId, feedback: feedbackVal }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ERROR', message: e.message }));
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/chat') {
    const t0 = Date.now();
    const requestId = crypto.randomUUID();
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const userMessage = (payload.message || '').trim();
        const sessionId = payload.session_id || ('session_' + Date.now());

        // Retrieve last session language
        const lastSessionLang = sessionLanguageMap.get(sessionId) || 'tr';

        // 1. Rate Limit Check
        if (!checkRateLimit(sessionId)) {
          const errRes = await handleGlobalError({
            request_id: requestId,
            session_id: sessionId,
            workflow_name: 'Chat_UI',
            error: { message: 'rate_limit exceeded' }
          });
          res.writeHead(429, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            request_id: requestId,
            status: 'ERROR',
            intent: 'RATE_LIMIT',
            title: 'Sistem Uyarısı',
            answer: errRes.user_message,
            sources: [],
            audit_id: errRes.audit_id
          }));
          return;
        }

        // 2. Length Limit Check
        if (userMessage.length > 4000) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            request_id: requestId,
            status: 'ERROR',
            intent: 'INVALID_INPUT',
            title: 'Girdi Uyarısı',
            answer: 'İstek güvenli kullanım sınırını aştı (maksimum 4.000 karakter). Lütfen sorunuzu daraltarak yeniden deneyin.',
            sources: []
          }));
          return;
        }

        // 3. Pre-Router Guard (Deterministic check with session language awareness)
        const guardRes = preRouteGuard(userMessage, lastSessionLang);
        let finalResult = null;
        let activeLang = guardRes.detected_language || lastSessionLang;

        // Update session language state
        sessionLanguageMap.set(sessionId, activeLang);

        if (guardRes.is_deterministic) {
          if (guardRes.intent === 'SMALL_TALK' || guardRes.intent === 'HELP' || guardRes.intent === 'UNKNOWN' || guardRes.intent === 'SECURITY_REJECTED') {
            finalResult = {
              status: 'SUCCESS',
              intent: guardRes.intent,
              intent_confidence: guardRes.intent_confidence,
              detected_language: activeLang,
              language_confidence: guardRes.language_confidence,
              response_language: activeLang,
              title: guardRes.title,
              answer: guardRes.answer,
              sources: guardRes.sources || [],
              route_used: guardRes.route_used,
              retrieval_used: false,
              original_question: userMessage,
              normalized_question: guardRes.normalized_question
            };
          } else if (guardRes.intent === 'ATTENDANCE_SQL') {
            const sqlRes = await executeSecureTextToSql(userMessage, sessionId, activeLang);
            finalResult = {
              status: sqlRes.status,
              intent: 'ATTENDANCE_SQL',
              intent_confidence: 0.98,
              detected_language: activeLang,
              language_confidence: guardRes.language_confidence,
              response_language: activeLang,
              title: activeLang === 'en' ? 'Attendance Info' : (activeLang === 'it' ? 'Info Presenze' : 'Devam Bilgisi'),
              answer: sqlRes.answer,
              sql: sqlRes.sql,
              sources: [
                {
                  source_id: 'attendance.daily_summary',
                  provider: 'POSTGRESQL',
                  message_id: 'attendance_daily_summary',
                  thread_id: null,
                  title: activeLang === 'en' ? 'Attendance Daily Summary' : (activeLang === 'it' ? 'Riepilogo Giornaliero Presenze' : 'Puantaj ve Turnike Günlük Özeti'),
                  sender: activeLang === 'en' ? 'Attendance DB' : (activeLang === 'it' ? 'DB Presenze' : 'Puantaj Veritabanı'),
                  received_at: null,
                  project_code: null,
                  data_mode: 'LIVE_TEST',
                  is_synthetic: false
                }
              ],
              retrieval_used: false,
              is_synthetic: false,
              original_question: userMessage,
              normalized_question: guardRes.normalized_question
            };
          } else if (guardRes.intent === 'PROJECT_MAIL') {
            const mailRes = await answerProjectMailQuery({
              question: userMessage,
              session_id: sessionId,
              query_mode: guardRes.entities?.query_mode,
              project_code: guardRes.entities?.project_code,
              sender: guardRes.entities?.sender,
              response_language: activeLang
            });
            finalResult = {
              status: mailRes.status,
              intent: 'PROJECT_MAIL',
              intent_confidence: 0.98,
              detected_language: activeLang,
              language_confidence: guardRes.language_confidence,
              response_language: activeLang,
              title: activeLang === 'en' ? 'Project Email (RAG)' : (activeLang === 'it' ? 'Email Progetto (RAG)' : 'Proje E-postası (RAG)'),
              answer: mailRes.answer,
              sources: mailRes.sources || [],
              is_synthetic: mailRes.is_synthetic,
              data_mode: mailRes.data_mode,
              synthetic_notice: mailRes.synthetic_notice,
              retrieval_used: true,
              original_question: userMessage,
              normalized_question: guardRes.normalized_question
            };
          } else if (guardRes.intent === 'COMPANY_KNOWLEDGE') {
            const companyRes = await answerCompanyKnowledgeQuestion(userMessage, sessionId);
            finalResult = {
              status: companyRes.status,
              intent: 'COMPANY_KNOWLEDGE',
              intent_confidence: 0.98,
              detected_language: activeLang,
              language_confidence: guardRes.language_confidence,
              response_language: activeLang,
              title: activeLang === 'en' ? 'Company Information' : (activeLang === 'it' ? 'Informazioni Aziendali' : 'Şirket Bilgisi'),
              answer: companyRes.answer,
              sources: companyRes.sources || [],
              retrieval_used: true,
              original_question: userMessage,
              normalized_question: guardRes.normalized_question
            };
          } else if (guardRes.intent === 'HYBRID') {
            const hybRes = await processHybridQuery({ question: userMessage, session_id: sessionId, response_language: activeLang });
            finalResult = {
              status: hybRes.status,
              intent: 'HYBRID',
              intent_confidence: 0.98,
              detected_language: activeLang,
              language_confidence: guardRes.language_confidence,
              response_language: activeLang,
              title: activeLang === 'en' ? 'Hybrid Analysis' : (activeLang === 'it' ? 'Analisi Ibrida' : 'Hibrit Analiz'),
              answer: hybRes.answer,
              sources: hybRes.sources || [],
              retrieval_used: true,
              original_question: userMessage,
              normalized_question: guardRes.normalized_question
            };
          } else if (guardRes.intent === 'HR_POLICY') {
            const hrRes = await queryHrPolicyRag(userMessage, activeLang);
            finalResult = {
              status: 'SUCCESS',
              intent: 'HR_POLICY',
              intent_confidence: 0.98,
              detected_language: activeLang,
              language_confidence: guardRes.language_confidence,
              response_language: activeLang,
              title: activeLang === 'en' ? 'HR Policy' : (activeLang === 'it' ? 'Info HR' : 'İK Bilgisi'),
              answer: hrRes.answer,
              sources: hrRes.sources,
              retrieval_used: true,
              is_synthetic: true,
              original_question: userMessage,
              normalized_question: guardRes.normalized_question
            };
          }
        } else {
          // 4. Non-deterministic query -> LLM Intent & Language Classification
          const llmRes = await queryLlmIntent(userMessage, activeLang);
          activeLang = llmRes.language || activeLang;
          sessionLanguageMap.set(sessionId, activeLang);

          if (llmRes.intent_confidence >= 0.70 && llmRes.intent === 'ATTENDANCE_SQL') {
            const sqlRes = await executeSecureTextToSql(userMessage, sessionId, activeLang);
            finalResult = {
              status: sqlRes.status,
              intent: 'ATTENDANCE_SQL',
              intent_confidence: llmRes.intent_confidence,
              detected_language: activeLang,
              language_confidence: llmRes.language_confidence,
              response_language: activeLang,
              title: activeLang === 'en' ? 'Attendance Info' : (activeLang === 'it' ? 'Info Presenze' : 'Devam Bilgisi'),
              answer: sqlRes.answer,
              sql: sqlRes.sql,
              sources: [
                {
                  source_id: 'attendance.daily_summary',
                  provider: 'POSTGRESQL',
                  message_id: 'attendance_daily_summary',
                  thread_id: null,
                  title: activeLang === 'en' ? 'Attendance Daily Summary' : (activeLang === 'it' ? 'Riepilogo Giornaliero Presenze' : 'Puantaj ve Turnike Günlük Özeti'),
                  sender: activeLang === 'en' ? 'Attendance DB' : (activeLang === 'it' ? 'DB Presenze' : 'Puantaj Veritabanı'),
                  received_at: null,
                  project_code: null,
                  data_mode: 'LIVE_TEST',
                  is_synthetic: false
                }
              ],
              retrieval_used: false,
              original_question: userMessage,
              normalized_question: userMessage
            };
          } else if (llmRes.intent_confidence >= 0.70 && llmRes.intent === 'PROJECT_MAIL') {
            const mailRes = await answerProjectMailQuery({ question: userMessage, session_id: sessionId, response_language: activeLang });
            finalResult = {
              status: mailRes.status,
              intent: 'PROJECT_MAIL',
              intent_confidence: llmRes.intent_confidence,
              detected_language: activeLang,
              language_confidence: llmRes.language_confidence,
              response_language: activeLang,
              title: activeLang === 'en' ? 'Project Email (RAG)' : (activeLang === 'it' ? 'Email Progetto (RAG)' : 'Proje E-postası (RAG)'),
              answer: mailRes.answer,
              sources: mailRes.sources || [],
              is_synthetic: mailRes.is_synthetic,
              data_mode: mailRes.data_mode,
              synthetic_notice: mailRes.synthetic_notice,
              retrieval_used: true,
              original_question: userMessage,
              normalized_question: userMessage
            };
          } else if (llmRes.intent_confidence >= 0.70 && llmRes.intent === 'COMPANY_KNOWLEDGE') {
            const companyRes = await answerCompanyKnowledgeQuestion(userMessage, sessionId);
            finalResult = {
              status: companyRes.status,
              intent: 'COMPANY_KNOWLEDGE',
              intent_confidence: llmRes.intent_confidence,
              detected_language: activeLang,
              language_confidence: llmRes.language_confidence,
              response_language: activeLang,
              title: activeLang === 'en' ? 'Company Information' : (activeLang === 'it' ? 'Informazioni Aziendali' : 'Şirket Bilgisi'),
              answer: companyRes.answer,
              sources: companyRes.sources || [],
              retrieval_used: true,
              original_question: userMessage,
              normalized_question: userMessage
            };
          } else if (llmRes.intent_confidence >= 0.70 && llmRes.intent === 'HR_POLICY') {
            const hrRes = await queryHrPolicyRag(userMessage, activeLang);
            finalResult = {
              status: 'SUCCESS',
              intent: 'HR_POLICY',
              intent_confidence: llmRes.intent_confidence,
              detected_language: activeLang,
              language_confidence: llmRes.language_confidence,
              response_language: activeLang,
              title: activeLang === 'en' ? 'HR Policy' : (activeLang === 'it' ? 'Info HR' : 'İK Bilgisi'),
              answer: hrRes.answer,
              sources: hrRes.sources,
              retrieval_used: true,
              is_synthetic: true,
              original_question: userMessage,
              normalized_question: userMessage
            };
          } else {
            // Default UNKNOWN in active language
            const unkMsgs = {
              tr: 'Bu isteğin hangi bilgi alanıyla ilgili olduğunu netleştiremedim. İK politikası, devam bilgisi veya proje güncellemesi olarak biraz daha açık sorabilir misiniz?',
              en: 'I could not determine which corporate domain this request belongs to. Could you please clarify your question regarding HR policies, attendance data, or project updates?',
              it: "Non sono riuscito a determinare l'ambito aziendale della richiesta. Puoi chiarire la domanda indicando se riguarda le politiche HR, le presenze o gli aggiornamenti di progetto?"
            };
            finalResult = {
              status: 'SUCCESS',
              intent: 'UNKNOWN',
              intent_confidence: 0.95,
              detected_language: activeLang,
              language_confidence: llmRes.language_confidence || 0.85,
              response_language: activeLang,
              title: activeLang === 'en' ? 'Clarification Needed' : (activeLang === 'it' ? 'Chiarimento Necessario' : 'Açıklama Gerekli'),
              answer: unkMsgs[activeLang] || unkMsgs.tr,
              sources: [],
              retrieval_used: false,
              original_question: userMessage,
              normalized_question: userMessage
            };
          }
        }

        const latencyMs = Date.now() - t0;
        const auditId = crypto.randomUUID();

        // 5. Audit Log (including language fields)
        try {
          const qHash = crypto.createHash('sha256').update(userMessage).digest('hex');
          const auditSql = `
            INSERT INTO audit.chat_request (
              request_id, session_id, question, redacted_question, question_hash,
              intent, intent_confidence, model_name, route_used,
              status, latency_ms, created_at
            ) VALUES (
              '${requestId}', '${sessionId}', '${userMessage.replace(/'/g, "''")}', '${userMessage.replace(/'/g, "''")}', '${qHash}',
              '${finalResult.intent}', ${finalResult.intent_confidence || 0.95}, 'qwen3.5:9b', '${finalResult.intent}',
              '${finalResult.status || 'SUCCESS'}', ${latencyMs}, now()
            );
          `;
          runAdminPsql(auditSql);
        } catch (e) {}

        const normalizedSources = (finalResult.sources || []).map(s => ({
          source_id: s.source_id || s.message_id || s.policy_code || null,
          provider: s.provider || 'SYSTEM',
          message_id: s.message_id || s.source_id || null,
          thread_id: s.thread_id || null,
          title: s.title || s.subject || (activeLang === 'en' ? 'Untitled Source' : (activeLang === 'it' ? 'Fonte Senza Titolo' : 'Başlıksız Kaynak')),
          sender: s.sender || null,
          received_at: s.received_at || null,
          project_code: s.project_code || null,
          data_mode: s.data_mode || (s.is_synthetic ? 'DEMO' : 'LIVE_TEST'),
          is_synthetic: s.is_synthetic === true || s.data_mode === 'DEMO'
        }));

        const isAnyDemo = normalizedSources.some(s => s.data_mode === 'DEMO' || s.is_synthetic === true);
        const hasLiveTest = normalizedSources.some(s => s.data_mode === 'LIVE_TEST');

        let computedNotice = null;
        if (isAnyDemo) {
          computedNotice = activeLang === 'en' ? 'This response contains synthetic demo data.' : (activeLang === 'it' ? 'Questa risposta contiene dati demo sintetici.' : 'Bu cevap sentetik demo verileri içermektedir.');
        } else if (hasLiveTest) {
          computedNotice = activeLang === 'en' ? 'This response is based on live test data.' : (activeLang === 'it' ? 'Questa risposta si basa su dati di test dal vivo.' : 'Bu cevap canlı test verilerine dayanmaktadır.');
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          request_id: requestId,
          audit_id: auditId,
          status: finalResult.status || 'SUCCESS',
          detected_language: finalResult.detected_language || activeLang,
          language_confidence: finalResult.language_confidence || 0.95,
          response_language: finalResult.response_language || activeLang,
          intent: finalResult.intent,
          intent_confidence: finalResult.intent_confidence || 0.95,
          original_question: userMessage,
          normalized_question: finalResult.normalized_question || userMessage,
          title: finalResult.title,
          answer: finalResult.answer,
          sources: normalizedSources,
          retrieval_used: finalResult.retrieval_used || false,
          is_synthetic: isAnyDemo,
          data_mode: isAnyDemo ? 'DEMO' : (hasLiveTest ? 'LIVE_TEST' : 'LIVE'),
          synthetic_notice: computedNotice,
          latency_ms: latencyMs
        }));

      } catch (err) {
        const errRes = await handleGlobalError({
          request_id: requestId,
          workflow_name: 'Chat_UI_Server',
          error: err
        });
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          request_id: requestId,
          status: 'ERROR',
          intent: 'SYSTEM_ERROR',
          title: 'Sistem Hatası',
          answer: errRes.user_message,
          sources: [],
          audit_id: errRes.audit_id
        }));
      }
    });
    return;
  }

  // 404 for other endpoints
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not Found');
});

server.listen(PORT, HOST, () => {
  console.log(`Management Chatbot Web UI running at http://${HOST}:${PORT}`);
});
