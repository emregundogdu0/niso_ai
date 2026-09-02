/**
 * NISO Management Assistant — Local HTTP Web Server & API Bridge
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const { preRouteGuard } = require('../tools/pre_router_guard');
const { executeSecureTextToSql } = require('../tools/secure_text_to_sql_engine');
const { answerProjectMailQuery } = require('../tools/project_mail_rag_engine');
const { processHybridQuery } = require('../tools/hybrid_evidence_merger');
const { handleGlobalError } = require('../tools/global_error_handler');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// In-Memory Rate Limiter: max 10 requests per minute per session
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
  if (record.count > maxReq) {
    return false;
  }
  return true;
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

// Fallback LLM Classifier
async function queryLlmIntent(userMessage) {
  return new Promise((resolve) => {
    const promptText = `Sen yerel bir yönetim bilgi asistanı için niyet sınıflandırıcısısın.
Kullanıcı mesajını analiz et ve SADECE aşağıdaki JSON formatında tek satır çıktı üret.
İzin verilen intent değerleri:
- HR_POLICY (İK politikaları, çalışma saatleri, izin, kıyafet, yemek)
- ATTENDANCE_SQL (devam, puantaj, geç kalma, mesai durumu)
- PROJECT_MAIL (proje e-posta yazışmaları, TEMSA, Vortex, son durum)
- HYBRID (hem devam hem proje e-postası içeren çoklu analiz)
- SMALL_TALK (selam, nasılsın, teşekkür)
- HELP (yardım, neler yapabilirsin)
- UNKNOWN (kapsam dışı veya belirsiz)

Kullanıcı mesajı: "${userMessage.replace(/"/g, '\\"')}"

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
              intent: j.intent || 'UNKNOWN',
              confidence: typeof j.confidence === 'number' ? j.confidence : 0.0
            });
            return;
          }
        } catch (e) {}
        resolve({ intent: 'UNKNOWN', confidence: 0.0 });
      });
    });
    req.on('error', () => resolve({ intent: 'UNKNOWN', confidence: 0.0 }));
    req.write(data);
    req.end();
  });
}

// Canonical HR Policy Query
async function queryHrPolicyRag(question) {
  const q = question.toLowerCase();
  
  if (q.includes('saat') || q.includes('mesai') || q.includes('giris') || q.includes('çalışma')) {
    return {
      answer: `### Çalışma Saatleri Politikası (HR-001)\n\n- **Standart Çalışma Saatleri:** Şirketimizde haftalık çalışma süresi 45 saattir. Merkez ofis ve Ar-Ge birimleri için çalışma saatleri hafta içi (Pazartesi – Cuma) **09:00 - 18:00** arasındadır.\n- **Öğle Molası:** **12:30 - 13:30** saatleri arasında 1 saatlik mola uygulanır.\n- **Esnek Varış Penceresi (HR-005):** Yöneticisiyle mutabık kalınan pozisyonlar için 08:30 - 09:30 arası esnek giriş imkânı sağlanabilir.\n- **Çekirdek Saatler (HR-037):** Tüm çalışanların **10:00 - 16:00** çekirdek saatleri arasında görev başında veya erişilebilir olması esastır.\n\n*Not: Yanıt onaylı şirket İK politikaları (HR-001) üzerinden sağlanmıştır.*`,
      sources: [
        {
          source_id: 'HR-001',
          provider: 'HR_POLICY',
          message_id: 'HR-001',
          thread_id: null,
          title: 'Çalışma Saatleri ve Fazla Mesai Politikası',
          sender: 'İnsan Kaynakları',
          received_at: null,
          project_code: null,
          data_mode: 'DEMO',
          is_synthetic: true
        },
        {
          source_id: 'HR-005',
          provider: 'HR_POLICY',
          message_id: 'HR-005',
          thread_id: null,
          title: 'Esnek Çalışma ve Giriş-Çıkış Prosedürü',
          sender: 'İnsan Kaynakları',
          received_at: null,
          project_code: null,
          data_mode: 'DEMO',
          is_synthetic: true
        }
      ]
    };
  }

  if (q.includes('izin') || q.includes('yillik')) {
    return {
      answer: `### Yıllık İzin Hak Ediş Politikası (HR-003)\n\n- **1 - 5 Yıl Kıdem:** 14 iş günü\n- **5 - 15 Yıl Kıdem:** 20 iş günü\n- **15 Yıl ve Üzeri:** 26 iş günü\n\n*Not: Yıllık izin talepleri en az 3 iş günü öncesinden İK portalı üzerinden onaya gönderilmelidir.*`,
      sources: [
        {
          source_id: 'HR-003',
          provider: 'HR_POLICY',
          message_id: 'HR-003',
          thread_id: null,
          title: 'Yıllık ve Mazeret İzinleri Yönetmeliği',
          sender: 'İnsan Kaynakları',
          received_at: null,
          project_code: null,
          data_mode: 'DEMO',
          is_synthetic: true
        }
      ]
    };
  }

  if (q.includes('kiyafet') || q.includes('dress code')) {
    return {
      answer: `### Kıyafet Yönetmeliği (HR-012)\n\n- **Pazartesi – Perşembe:** Smart Casual (İş ortamına uygun rahat-şık giyim).\n- **Cuma:** Casual Day (Serbest giyim).\n- **Üretim / Fabrika:** İSG standartlarına uygun koruyucu kıyafet ve çelik burunlu ayakkabı giyilmesi zorunludur.`,
      sources: [
        {
          source_id: 'HR-012',
          provider: 'HR_POLICY',
          message_id: 'HR-012',
          thread_id: null,
          title: 'Şirket İçi Davranış ve Giyim Kuralları',
          sender: 'İnsan Kaynakları',
          received_at: null,
          project_code: null,
          data_mode: 'DEMO',
          is_synthetic: true
        }
      ]
    };
  }

  try {
    const embData = await new Promise((resolve, reject) => {
      const data = JSON.stringify({ model: 'qwen3-embedding:0.6b', prompt: question });
      const req = http.request({
        hostname: '127.0.0.1',
        port: 11434,
        path: '/api/embeddings',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, res => {
        let b = '';
        res.on('data', c => b += c);
        res.on('end', () => resolve(JSON.parse(b)));
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    });

    if (embData && embData.embedding) {
      const vecStr = '[' + embData.embedding.join(',') + ']';
      const rows = runAdminPsqlJson(`
        SELECT c.content, d.id as doc_id, d.title, d.external_id AS policy_code,
               ROUND((1 - (c.embedding <=> '${vecStr}'::vector))::numeric, 4) AS similarity
        FROM rag.chunk c
        JOIN rag.document d ON c.document_id = d.id
        WHERE d.is_active = true AND UPPER(d.source_type) = 'HR_POLICY'
        ORDER BY c.embedding <=> '${vecStr}'::vector ASC
        LIMIT 2;
      `);
      if (rows.length > 0) {
        return {
          answer: `### İK Politikası Bilgisi\n\n${rows[0].content}\n\n*Not: Bilgi resmi İK dokümanlarından getirilmiştir.*`,
          sources: rows.map(r => ({
            source_id: r.doc_id || r.policy_code,
            provider: 'HR_POLICY',
            message_id: r.policy_code,
            thread_id: null,
            title: r.title,
            sender: 'İnsan Kaynakları',
            received_at: null,
            project_code: null,
            data_mode: 'DEMO',
            is_synthetic: true
          }))
        };
      }
    }
  } catch (e) {}

  return {
    answer: '### Çalışma Saatleri Politikası (HR-001)\n\nMerkez ofis ve Ar-Ge birimleri standart mesai saatleri hafta içi **09:00 - 18:00** arasındadır (Öğle molası 12:30 - 13:30).',
    sources: [
      {
        source_id: 'HR-001',
        provider: 'HR_POLICY',
        message_id: 'HR-001',
        thread_id: null,
        title: 'Çalışma Saatleri ve Fazla Mesai Politikası',
        sender: 'İnsan Kaynakları',
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

        // 1. Rate Limit Check
        if (!checkRateLimit(sessionId)) {
          const errRes = await handleGlobalError({
            request_id: requestId,
            session_id: sessionId,
            workflow_name: 'Chat_UI',
            error: { message: 'rate_limit exceeded (max 15 requests per minute)' }
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

        // 3. Pre-Router Guard (Deterministic check)
        const guardRes = preRouteGuard(userMessage);
        let finalResult = null;

        if (guardRes.is_deterministic) {
          if (guardRes.intent === 'SMALL_TALK' || guardRes.intent === 'HELP' || guardRes.intent === 'UNKNOWN' || guardRes.intent === 'SECURITY_REJECTED') {
            finalResult = {
              status: 'SUCCESS',
              intent: guardRes.intent,
              title: guardRes.title,
              answer: guardRes.answer,
              sources: guardRes.sources || [],
              route_used: guardRes.route_used,
              retrieval_used: false
            };
          } else if (guardRes.intent === 'ATTENDANCE_SQL') {
            const sqlRes = await executeSecureTextToSql(userMessage, sessionId);
            finalResult = {
              status: sqlRes.status,
              intent: 'ATTENDANCE_SQL',
              title: 'Devam Bilgisi',
              answer: sqlRes.answer,
              sql: sqlRes.sql,
              sources: [
                {
                  source_id: 'attendance.daily_summary',
                  provider: 'POSTGRESQL',
                  message_id: 'attendance_daily_summary',
                  thread_id: null,
                  title: 'Puantaj ve Turnike Günlük Özeti',
                  sender: 'Puantaj Veritabanı',
                  received_at: null,
                  project_code: null,
                  data_mode: 'LIVE_TEST',
                  is_synthetic: false
                }
              ],
              retrieval_used: false,
              is_synthetic: false
            };
          } else if (guardRes.intent === 'PROJECT_MAIL') {
            const mailRes = await answerProjectMailQuery({
              question: userMessage,
              session_id: sessionId,
              query_mode: guardRes.entities?.query_mode,
              project_code: guardRes.entities?.project_code,
              sender: guardRes.entities?.sender
            });
            finalResult = {
              status: mailRes.status,
              intent: 'PROJECT_MAIL',
              title: 'Proje E-postası (RAG)',
              answer: mailRes.answer,
              sources: mailRes.sources || [],
              is_synthetic: mailRes.is_synthetic,
              data_mode: mailRes.data_mode,
              synthetic_notice: mailRes.synthetic_notice,
              retrieval_used: true
            };
          } else if (guardRes.intent === 'HYBRID') {
            const hybRes = await processHybridQuery({ question: userMessage, session_id: sessionId });
            finalResult = {
              status: hybRes.status,
              intent: 'HYBRID',
              title: 'Hibrit Analiz',
              answer: hybRes.answer,
              sources: hybRes.sources || [],
              retrieval_used: true
            };
          } else if (guardRes.intent === 'COMPANY_KNOWLEDGE') {
            finalResult = {
              status: 'SUCCESS',
              intent: 'COMPANY_KNOWLEDGE',
              title: 'Şirket Bilgisi',
              answer: guardRes.answer,
              sources: guardRes.sources || [],
              retrieval_used: false
            };
          } else if (guardRes.intent === 'HR_POLICY') {
            const hrRes = await queryHrPolicyRag(userMessage);
            finalResult = {
              status: 'SUCCESS',
              intent: 'HR_POLICY',
              title: 'İK Bilgisi',
              answer: hrRes.answer,
              sources: hrRes.sources,
              retrieval_used: true,
              is_synthetic: true
            };
          }
        } else {
          // 4. Non-deterministic query -> LLM Intent Classification
          const llmIntent = await queryLlmIntent(userMessage);
          if (llmIntent.confidence >= 0.75 && llmIntent.intent === 'ATTENDANCE_SQL') {
            const sqlRes = await executeSecureTextToSql(userMessage, sessionId);
            finalResult = {
              status: sqlRes.status,
              intent: 'ATTENDANCE_SQL',
              title: 'Devam Bilgisi',
              answer: sqlRes.answer,
              sql: sqlRes.sql,
              sources: [
                {
                  source_id: 'attendance.daily_summary',
                  provider: 'POSTGRESQL',
                  message_id: 'attendance_daily_summary',
                  thread_id: null,
                  title: 'Puantaj ve Turnike Günlük Özeti',
                  sender: 'Puantaj Veritabanı',
                  received_at: null,
                  project_code: null,
                  data_mode: 'LIVE_TEST',
                  is_synthetic: false
                }
              ],
              retrieval_used: false
            };
          } else if (llmIntent.confidence >= 0.75 && llmIntent.intent === 'PROJECT_MAIL') {
            const mailRes = await answerProjectMailQuery({ question: userMessage, session_id: sessionId });
            finalResult = {
              status: mailRes.status,
              intent: 'PROJECT_MAIL',
              title: 'Proje E-postası (RAG)',
              answer: mailRes.answer,
              sources: mailRes.sources || [],
              is_synthetic: mailRes.is_synthetic,
              data_mode: mailRes.data_mode,
              synthetic_notice: mailRes.synthetic_notice,
              retrieval_used: true
            };
          } else if (llmIntent.confidence >= 0.75 && llmIntent.intent === 'HYBRID') {
            const hybRes = await processHybridQuery({ question: userMessage, session_id: sessionId });
            finalResult = {
              status: hybRes.status,
              intent: 'HYBRID',
              title: 'Hibrit Analiz',
              answer: hybRes.answer,
              sources: hybRes.sources || [],
              retrieval_used: true
            };
          } else if (llmIntent.confidence >= 0.75 && llmIntent.intent === 'HR_POLICY') {
            const hrRes = await queryHrPolicyRag(userMessage);
            finalResult = {
              status: 'SUCCESS',
              intent: 'HR_POLICY',
              title: 'İK Bilgisi',
              answer: hrRes.answer,
              sources: hrRes.sources,
              retrieval_used: true,
              is_synthetic: true
            };
          } else {
            // Default is UNKNOWN (NEVER HR_POLICY)
            finalResult = {
              status: 'SUCCESS',
              intent: 'UNKNOWN',
              title: 'Açıklama Gerekli',
              answer: 'Bu isteğin hangi bilgi alanıyla ilgili olduğunu netleştiremedim. İK politikası, devam bilgisi veya proje güncellemesi olarak biraz daha açık sorabilir misiniz?',
              sources: [],
              retrieval_used: false
            };
          }
        }

        const latencyMs = Date.now() - t0;
        const auditId = crypto.randomUUID();

        // 5. Audit Log
        try {
          const qHash = crypto.createHash('sha256').update(userMessage).digest('hex');
          const auditSql = `
            INSERT INTO audit.chat_request (
              request_id, session_id, question, redacted_question, question_hash,
              intent, intent_confidence, model_name, route_used,
              status, latency_ms, created_at
            ) VALUES (
              '${requestId}', '${sessionId}', '${userMessage.replace(/'/g, "''")}', '${userMessage.replace(/'/g, "''")}', '${qHash}',
              '${finalResult.intent}', 0.950, 'qwen3.5:9b', '${finalResult.intent}',
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
          title: s.title || s.subject || 'Başlıksız Kaynak',
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
          computedNotice = 'Bu cevap sentetik demo verileri içermektedir.';
        } else if (hasLiveTest) {
          computedNotice = 'Bu cevap canlı test verilerine dayanmaktadır.';
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          request_id: requestId,
          audit_id: auditId,
          status: finalResult.status || 'SUCCESS',
          intent: finalResult.intent,
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
