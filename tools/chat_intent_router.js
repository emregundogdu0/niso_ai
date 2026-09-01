const { execSync } = require('child_process');
const crypto = require('crypto');

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const LLM_MODEL = 'qwen3.5:9b';

const SYSTEM_PROMPT = `Sen bir Yönetim ve İK Bilgi Asistanı Niyet Sınıflandırıcısısın (Intent Router).
Görevin, kullanıcı sorusunu analiz ederek aşağıdaki 5 niyetten (intent) birine sınıflandırmak ve kesinlikle geçerli bir JSON nesnesi döndürmektir:

INTENT TANIMLARI:
1. HR_POLICY: Şirketin İK politikaları, izin hakları (yıllık, mazeret, doğum, evlilik vb.), mesai/çalışma saatleri kuralları, kıyafet kuralı (dress code), yemek/yol/sağlık sigortası gibi yan haklar, avans ve bordro prosedürü, iş sağlığı ve güvenliği kuralları, istifa, çıkış mülakatı ve etik kurallar.
2. ATTENDANCE_SQL: Çalışanların fiili giriş-çıkış saatleri, geç kalma, bugün kimler geldi/gelmedi, devamsızlık listesi, günlük yoklama, turnike kayıtları, mesai çizelgesi ve puantaj verileri.
3. PROJECT_MAIL: Şirket projelerinin durumu, teslimat takvimi, müşteri/paydaş e-posta yazışmaları, proje toplantı notları, e-posta gelen kutusu sorguları.
4. HYBRID: Birden fazla alanı birleştiren sorular (örneğin: hem devam/turnike kaydı hem proje mail durumu, veya hem İK kuralı hem proje yazışması).
5. UNKNOWN: Şirket yönetimi, İK, çalışan devamı veya proje dışındaki her türlü konu (selamlaşma, şiir yazma, hava durumu, genel bilgi, felsefe, kod yazma vb.).

ÇIKTI KURALLARI:
- Sadece ve sadece aşağıdaki JSON formatında çıktı üret.
- Markdown (\`\`\`json) veya düşünce blokları ekleme.
- Confidence değeri 0.0 ile 1.0 arasında bir ondalıklı sayı olmalıdır.

JSON ŞEMASI:
{
  "intent": "HR_POLICY" | "ATTENDANCE_SQL" | "PROJECT_MAIL" | "HYBRID" | "UNKNOWN",
  "confidence": 0.95,
  "normalized_question": "...",
  "entities": {
    "date_range": "bugün" | "bu hafta" | null,
    "employee": "Ahmet Yılmaz" | null,
    "department": "Yazılım" | null,
    "project": "TEMSA" | null
  },
  "needs_fresh_data": true | false,
  "reason": "Sınıflandırmanın kısa Türkçe gerekçesi"
}`;

function runPsql(sqlQuery) {
  return execSync('docker exec -i management-postgres psql -U management_admin -d management_ai -q -X', {
    input: Buffer.from(sqlQuery, 'utf8'),
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024
  });
}

function extractJson(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Model output is empty or not a string.');
  }
  // Strip <think>...</think> tags if any
  let clean = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  clean = clean.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();

  // Match outermost { ... }
  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    clean = clean.substring(firstBrace, lastBrace + 1);
  }

  return JSON.parse(clean);
}

function checkInputGuard(userInput) {
  if (!userInput || typeof userInput !== 'string' || userInput.trim().length === 0) {
    return {
      passed: false,
      reason: 'EMPTY_INPUT',
      message: 'Lütfen bir soru veya mesaj yazınız.'
    };
  }

  const trimmed = userInput.trim();
  if (trimmed.length > 2000) {
    return {
      passed: false,
      reason: 'EXCESSIVE_LENGTH',
      message: 'Mesajınız çok uzun. Lütfen sorunuzu 2000 karakterden kısa olacak şekilde iletiniz.'
    };
  }

  // Prompt Injection heuristic check
  const injectionPatterns = [
    /ignore (all )?previous instructions/i,
    /system prompt/i,
    /you are now/i,
    /jailbreak/i,
    /dan mode/i,
    /drop table/i,
    /select \* from/i,
    /<script/i,
    /eval\(/i,
    /exec\(/i
  ];

  const injectionSuspected = injectionPatterns.some(pattern => pattern.test(trimmed));

  return {
    passed: true,
    normalized_input: trimmed,
    injection_suspected: injectionSuspected
  };
}

async function routeChatRequest(userInput, sessionId = 'session_default') {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  // 1. Input Guard
  const guard = checkInputGuard(userInput);
  if (!guard.passed) {
    const latencyMs = Date.now() - startTime;
    await logAuditRecord({
      requestId,
      sessionId,
      question: String(userInput || ''),
      intent: 'UNKNOWN',
      confidence: 0.0,
      status: 'GUARD_REJECTED',
      latencyMs,
      metadata: { rejection_reason: guard.reason }
    });

    return {
      request_id: requestId,
      session_id: sessionId,
      intent: 'UNKNOWN',
      confidence: 0.0,
      status: 'GUARD_REJECTED',
      response: guard.message,
      latency_ms: latencyMs
    };
  }

  // 2. Call LLM for Intent Classification
  let classification = null;
  let rawResponseText = '';
  let status = 'SUCCESS';

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: guard.normalized_input }
        ],
        stream: false,
        format: 'json',
        options: {
          temperature: 0.0,
          think: false
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    rawResponseText = data.message?.content || data.response || '';
    classification = extractJson(rawResponseText);
  } catch (err) {
    console.error('LLM Intent Classification Error:', err.message);
    status = 'LLM_PARSE_ERROR';
    classification = {
      intent: 'UNKNOWN',
      confidence: 0.0,
      normalized_question: guard.normalized_input,
      entities: { date_range: null, employee: null, department: null, project: null },
      needs_fresh_data: false,
      reason: `LLM yanıtı ayrıştırılamadı: ${err.message}`
    };
  }

  // Normalize intent & confidence
  const validIntents = ['HR_POLICY', 'ATTENDANCE_SQL', 'PROJECT_MAIL', 'HYBRID', 'UNKNOWN'];
  let intent = validIntents.includes(classification.intent) ? classification.intent : 'UNKNOWN';
  let confidence = typeof classification.confidence === 'number' ? Math.max(0, Math.min(1, classification.confidence)) : 0.5;

  // 3. Confidence Check (< 0.75 threshold)
  let responseMessage = '';
  if (confidence < 0.75 && intent !== 'UNKNOWN') {
    status = 'LOW_CONFIDENCE';
    responseMessage = `Sorunuz tam anlaşılamadı (Güven: %${Math.round(confidence * 100)}). Lütfen şirket İK politikaları, çalışan devam durumu veya proje yazışmalarıyla ilgili daha net bir soru belirtiniz.`;
    intent = 'UNKNOWN';
  } else {
    // 4. Placeholder Routing
    switch (intent) {
      case 'HR_POLICY':
        responseMessage = 'HR route selected (İK RAG ve CAG modülleri sonraki aşamada bağlanacak).';
        break;
      case 'ATTENDANCE_SQL':
        responseMessage = 'ATTENDANCE_SQL route selected (Devam takip SQL modülü sonraki aşamada bağlanacak).';
        break;
      case 'PROJECT_MAIL':
        responseMessage = 'PROJECT_MAIL route selected (Proje e-posta aracı sonraki aşamada bağlanacak).';
        break;
      case 'HYBRID':
        responseMessage = 'HYBRID route selected (Hibrit yönetim modülü sonraki aşamada bağlanacak).';
        break;
      case 'UNKNOWN':
      default:
        responseMessage = 'UNKNOWN route selected (Sorunuz şirket politikaları, devam durumu veya proje yazışmaları kapsamı dışındadır. Lütfen yönetim veya İK ile ilgili bir soru iletiniz).';
        break;
    }
  }

  const latencyMs = Date.now() - startTime;

  // 5. Audit Logging
  await logAuditRecord({
    requestId,
    sessionId,
    question: guard.normalized_input,
    intent,
    confidence,
    status,
    latencyMs,
    metadata: {
      entities: classification.entities || {},
      needs_fresh_data: Boolean(classification.needs_fresh_data),
      reason: classification.reason || '',
      injection_suspected: guard.injection_suspected || false,
      model: LLM_MODEL,
      raw_llm_response: rawResponseText.substring(0, 300)
    }
  });

  return {
    request_id: requestId,
    session_id: sessionId,
    intent,
    confidence,
    status,
    normalized_question: classification.normalized_question || guard.normalized_input,
    entities: classification.entities || {},
    needs_fresh_data: Boolean(classification.needs_fresh_data),
    reason: classification.reason || '',
    response: responseMessage,
    latency_ms: latencyMs
  };
}

async function logAuditRecord({ requestId, sessionId, question, intent, confidence, status, latencyMs, metadata }) {
  try {
    const escapedQuestion = question.replace(/'/g, "''");
    const escapedIntent = intent.replace(/'/g, "''");
    const escapedStatus = status.replace(/'/g, "''");
    const escapedSessionId = sessionId ? `'${sessionId.replace(/'/g, "''")}'` : 'NULL';
    const metadataJson = JSON.stringify(metadata || {}).replace(/'/g, "''");

    const sql = `
      INSERT INTO audit.chat_request (
        request_id, session_id, question, intent,
        confidence, status, latency_ms, metadata, created_at
      ) VALUES (
        '${requestId}',
        ${escapedSessionId},
        '${escapedQuestion}',
        '${escapedIntent}',
        ${confidence.toFixed(3)},
        '${escapedStatus}',
        ${latencyMs},
        '${metadataJson}'::jsonb,
        now()
      );
    `;

    runPsql(sql);
  } catch (err) {
    console.error('Failed to log audit record to PostgreSQL:', err.message);
  }
}

module.exports = {
  routeChatRequest,
  checkInputGuard,
  SYSTEM_PROMPT,
  extractJson
};

if (require.main === module) {
  (async () => {
    const sample = process.argv[2] || 'Çalışma saatleri nedir?';
    console.log(`Testing query: "${sample}"`);
    const res = await routeChatRequest(sample);
    console.log('Result:', JSON.stringify(res, null, 2));
  })();
}
