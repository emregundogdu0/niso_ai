const fs = require('fs');
const path = require('path');

const preRouterJsCode = `
const item = $input.first().json;
const message = item.chatInput || item.message || item.text || item.question || item.body?.message || '';
const raw = String(message || '').trim();
const sessionId = item.sessionId || item.body?.session_id || ('session_' + Date.now());

function generateUuidV4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
const requestId = item.requestId || item.body?.request_id || generateUuidV4();

function normalizeTurkish(str) {
  if (!str) return '';
  return str
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .replace(/ı/g, 'i')
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/Ğ/g, 'g')
    .replace(/ö/g, 'o')
    .replace(/Ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/Ş/g, 's')
    .replace(/ü/g, 'u')
    .replace(/Ü/g, 'u')
    .toLowerCase()
    .replace(/[.,\\/#!$%\\^&\\*;:{}=\\-_'~()?'"\\+]/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim();
}

if (!raw) {
  return [{
    json: {
      is_deterministic: true,
      intent: 'UNKNOWN',
      title: 'Açıklama Gerekli',
      answer: 'Lütfen yanıtlayabileceğim bir soru veya mesaj yazınız.',
      confidence: 1.0,
      route_used: 'EMPTY_INPUT',
      retrieval_used: false,
      sources: [],
      raw_message: raw,
      question: raw,
      session_id: sessionId,
      request_id: requestId
    }
  }];
}

const norm = normalizeTurkish(raw);

// 1. Security / Jailbreak / Malicious attack
const securityPatterns = [
  'veritabanini sil', 'tablolari sil', 'drop table', 'delete from', 'truncate table',
  'sifreleri goster', 'sifreleri listele', 'credentiallari goster', 'sistem promptunu goster',
  'onceki talimatlari unut', 'ignore previous instructions', 'butun kisisel verilerini dondur',
  'calisanlarin butun kisisel verilerini'
];
if (securityPatterns.some(p => norm.includes(p))) {
  return [{
    json: {
      is_deterministic: true,
      intent: 'SECURITY_REJECTED',
      title: 'Güvenli Ret',
      answer: 'Bu isteği güvenlik ve yetkilendirme kuralları nedeniyle gerçekleştiremiyorum.',
      confidence: 1.0,
      route_used: 'SECURITY_GUARD',
      retrieval_used: false,
      sources: [],
      raw_message: raw,
      question: raw,
      session_id: sessionId,
      request_id: requestId
    }
  }];
}

// 2. Pure Small Talk
const greetings = ['merhaba', 'merhabalar', 'selam', 'selamlar', 'gunaydin', 'iyi gunler', 'iyi aksamlar', 'iyi geceler', 'hey', 'hi', 'hello', 'slm', 'mrb'];
const pleasantries = ['nasilsin', 'nasil gidiyor', 'ne haber', 'naber', 'iyi misin', 'ne yapiyorsun', 'napiyorsun', 'keyifler nasil', 'selam nasilsin', 'merhaba nasilsin'];
const thanks = ['tesekkurler', 'tesekkur ederim', 'sag ol', 'sagol', 'eyvallah', 'tamamdir', 'tamam'];
const farewells = ['gorusuruz', 'hosca kal', 'hoscakal', 'kendine iyi bak', 'bay bay', 'bye'];
const allSmallTalk = [...greetings, ...pleasantries, ...thanks, ...farewells];

if (allSmallTalk.includes(norm)) {
  let ans = 'Merhaba! Size nasıl yardımcı olabilirim? İK politikaları, devam bilgileri veya proje güncellemeleri hakkında soru sorabilirsiniz.';
  if (pleasantries.includes(norm)) {
    ans = 'İyiyim, teşekkür ederim. Size nasıl yardımcı olabilirim? İK politikaları, devam bilgileri veya proje güncellemeleri hakkında soru sorabilirsiniz.';
  } else if (thanks.includes(norm)) {
    ans = 'Rica ederim. Başka bir konuda yardımcı olabilir miyim?';
  } else if (farewells.includes(norm)) {
    ans = 'Görüşmek üzere, iyi günler dilerim.';
  }
  return [{
    json: {
      is_deterministic: true,
      intent: 'SMALL_TALK',
      title: 'Asistan',
      answer: ans,
      confidence: 1.0,
      route_used: 'SMALL_TALK_LOCAL',
      retrieval_used: false,
      sources: [],
      raw_message: raw,
      question: raw,
      session_id: sessionId,
      request_id: requestId
    }
  }];
}

// 3. Help Detection
const helpPatterns = ['neler yapabilirsin', 'neler yapabiliyorsun', 'nasil kullanilir', 'bana nasil yardimci olabilirsin', 'hangi sorulari sorabilirim', 'ozelliklerin neler', 'yardim', 'help', 'yardim eder misin', 'yardimci olabilir misin'];
if (helpPatterns.includes(norm)) {
  return [{
    json: {
      is_deterministic: true,
      intent: 'HELP',
      title: 'Yardım',
      answer: '### Yönetim Bilgi Asistanı Yetenekleri\\n\\n- **İK Politikaları:** Çalışma saatleri, giriş toleransı, yıllık izin hak edişi, dress code ve şirket kuralları.\\n- **Devam ve Puantaj Bilgisi (SQL):** Bugün veya belirli tarihlerde geç kalanlar, zamanında gelenler, mesaide olanlar.\\n- **Proje E-posta Güncellemeleri (RAG):** TEMSA, VORTEX ve diğer projelere ait e-posta akışları, sprint durumları ve teslim tarihleri.\\n- **Hibrit Analiz:** Devam verileri ile proje e-postalarını birleştiren çok kaynaklı korelasyon analizleri.',
      confidence: 1.0,
      route_used: 'HELP_LOCAL',
      retrieval_used: false,
      sources: [],
      raw_message: raw,
      question: raw,
      session_id: sessionId,
      request_id: requestId
    }
  }];
}

// 4. Strip leading greetings/fillers to extract the core question
let stripped = norm;
for (const g of greetings) {
  if (stripped.startsWith(g + ' ')) {
    stripped = stripped.substring(g.length).trim();
    break;
  }
}

const attendanceKeywords = ['gec kaldi', 'gec kalan', 'mesaide', 'ise geldi', 'zamaninda gelen', 'izinli', 'uzaktan calisan', 'kac kisi', 'puantaj', 'gecikme'];
const hrKeywords = ['calisma saatleri', 'calisma saati', 'dress code', 'kiyafet', 'dogum izni', 'yillik izin', 'yemek yardim', 'yol yardim', 'deneme suresi', 'prim politikasi', 'resmi tatiller'];
const projectKeywords = ['temsa', 'vortex', 'eldor obc', 'smart factory', 'bms', 'ecu', 'proje e posta', 'proje guncelleme', 'proje'];
const companyKeywords = ['niso ne is yapar', 'sirket hangi hizmetleri', 'fabrikanin adresi', 'faaliyet alanlari'];

const hasAttendance = attendanceKeywords.some(k => stripped.includes(k));
const hasHr = hrKeywords.some(k => stripped.includes(k));
const hasProject = projectKeywords.some(k => stripped.includes(k));
const hasCompany = companyKeywords.some(k => stripped.includes(k));

if (hasProject && (hasAttendance || (stripped.includes('risk') && stripped.includes('gecikme')))) {
  return [{ json: { is_deterministic: true, intent: 'HYBRID', question: raw, confidence: 0.98, raw_message: raw, session_id: sessionId, request_id: requestId } }];
}
if (hasAttendance) {
  return [{ json: { is_deterministic: true, intent: 'ATTENDANCE_SQL', question: raw, confidence: 0.98, raw_message: raw, session_id: sessionId, request_id: requestId } }];
}
if (hasHr) {
  return [{ json: { is_deterministic: true, intent: 'HR_POLICY', question: raw, confidence: 0.98, raw_message: raw, session_id: sessionId, request_id: requestId } }];
}
if (hasProject) {
  return [{ json: { is_deterministic: true, intent: 'PROJECT_MAIL', question: raw, confidence: 0.95, raw_message: raw, session_id: sessionId, request_id: requestId } }];
}
if (hasCompany) {
  return [{ json: { is_deterministic: true, intent: 'COMPANY_KNOWLEDGE', question: raw, confidence: 0.95, raw_message: raw, session_id: sessionId, request_id: requestId } }];
}

// 5. Unknown out-of-domain heuristics
const unknownPatterns = ['siir yaz', 'hava nasil', 'yemek tarifi', 'sacma bir sey', 'xyzabc', 'fikra anlat', 'sarki soyle'];
if (unknownPatterns.some(p => norm.includes(p))) {
  return [{
    json: {
      is_deterministic: true,
      intent: 'UNKNOWN',
      title: 'Açıklama Gerekli',
      answer: 'Bu isteğin hangi bilgi alanıyla ilgili olduğunu netleştiremedim. İK politikası, devam bilgisi veya proje güncellemesi olarak biraz daha açık sorabilir misiniz?',
      confidence: 0.99,
      route_used: 'UNKNOWN',
      retrieval_used: false,
      sources: [],
      raw_message: raw,
      question: raw,
      session_id: sessionId,
      request_id: requestId
    }
  }];
}

// Non-deterministic: send to LLM
return [{
  json: {
    is_deterministic: false,
    question: raw,
    raw_message: raw,
    session_id: sessionId,
    request_id: requestId
  }
}];
`;

const postLlmValidatorJsCode = `
const guardItem = $('Pre-Router Guard & Normalization').first().json;
const llmRes = $input.first()?.json || {};
const rawText = llmRes.response || '{}';

let parsed = {};
try {
  const jsonMatch = rawText.match(/\\{[\\s\\S]*?\\}/);
  if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
} catch (e) {}

let intent = String(parsed.intent || 'UNKNOWN').toUpperCase();
let confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.0;

const validIntents = ['HR_POLICY', 'ATTENDANCE_SQL', 'COMPANY_KNOWLEDGE', 'PROJECT_MAIL', 'HYBRID', 'SMALL_TALK', 'HELP', 'UNKNOWN', 'SECURITY_REJECTED'];
if (!validIntents.includes(intent)) {
  intent = 'UNKNOWN';
}

if (confidence < 0.75) {
  intent = 'UNKNOWN';
}

let answer = '';
let title = '';
let routeUsed = intent;

if (intent === 'UNKNOWN') {
  title = 'Açıklama Gerekli';
  answer = 'Bu isteğin hangi bilgi alanıyla ilgili olduğunu netleştiremedim. İK politikası, devam bilgisi veya proje güncellemesi olarak biraz daha açık sorabilir misiniz?';
}

return [{
  json: {
    is_deterministic: true,
    intent: intent,
    title: title,
    answer: answer,
    confidence: confidence,
    route_used: routeUsed,
    question: guardItem.question || guardItem.raw_message,
    raw_message: guardItem.raw_message,
    session_id: guardItem.session_id,
    request_id: guardItem.request_id,
    retrieval_used: false,
    sources: []
  }
}];
`;

const unifiedFormatterJsCode = `
const item = $input.first().json;
let intent = item.intent;

if (!intent) {
  if (item.route_used === 'CAG_RAG' || item.route_used === 'RAG' || item.route_used === 'CAG' || item.route_used === 'HR_POLICY') {
    intent = 'HR_POLICY';
  } else if (item.route_used === 'ATTENDANCE_SQL' || item.sql || item.generated_sql) {
    intent = 'ATTENDANCE_SQL';
  } else if (item.route_used === 'PROJECT_MAIL' || item.project_code) {
    intent = 'PROJECT_MAIL';
  } else if (item.route_used === 'HYBRID' || item.attendance_evidence || item.mail_evidence) {
    intent = 'HYBRID';
  } else if (item.route_used === 'COMPANY_KNOWLEDGE') {
    intent = 'COMPANY_KNOWLEDGE';
  } else {
    intent = 'UNKNOWN';
  }
}

let title = item.title;
let answer = item.answer || '';
let routeUsed = item.route_used || intent;
let sources = item.sources || [];
let retrievalUsed = !!item.retrieval_used || (sources.length > 0);
let generatedSql = item.sql || item.generated_sql || null;
let isSynthetic = item.is_synthetic || false;
let syntheticNotice = item.synthetic_notice || null;

if (intent === 'SMALL_TALK') {
  title = 'Asistan';
  routeUsed = 'SMALL_TALK_LOCAL';
  retrievalUsed = false;
  sources = [];
} else if (intent === 'HELP') {
  title = 'Yardım';
  routeUsed = 'HELP_LOCAL';
  retrievalUsed = false;
  sources = [];
} else if (intent === 'UNKNOWN') {
  title = 'Açıklama Gerekli';
  routeUsed = 'UNKNOWN';
  retrievalUsed = false;
  sources = [];
} else if (intent === 'SECURITY_REJECTED') {
  title = 'Güvenli Ret';
  routeUsed = 'SECURITY_GUARD';
  retrievalUsed = false;
  sources = [];
} else if (intent === 'HR_POLICY') {
  title = 'İK Bilgisi';
  routeUsed = routeUsed || 'HR_POLICY';
} else if (intent === 'ATTENDANCE_SQL') {
  title = 'Devam Bilgisi';
  routeUsed = 'ATTENDANCE_SQL';
} else if (intent === 'COMPANY_KNOWLEDGE') {
  title = 'Şirket Bilgisi';
  routeUsed = 'COMPANY_KNOWLEDGE';
} else if (intent === 'PROJECT_MAIL') {
  title = 'Proje E-postası (RAG)';
  routeUsed = 'PROJECT_MAIL';
} else if (intent === 'HYBRID') {
  title = 'Hibrit Analiz';
  routeUsed = 'HYBRID';
}

function generateUuidV4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

return [{
  json: {
    status: 'SUCCESS',
    intent: intent,
    title: title,
    route_used: routeUsed,
    answer: answer,
    sources: sources,
    source_count: sources.length,
    generated_sql: generatedSql,
    retrieval_used: retrievalUsed,
    is_synthetic: isSynthetic,
    synthetic_notice: syntheticNotice,
    request_id: item.request_id || generateUuidV4(),
    session_id: item.session_id || 'default_session',
    confidence: item.confidence || 0.95
  }
}];
`;

const workflow06 = {
  id: "m3C576WsNJ765h0S",
  name: "06_Chat_Intent_Router",
  active: true,
  nodes: [
    {
      parameters: {
        httpMethod: "POST",
        path: "chat-router",
        responseMode: "responseNode",
        options: {}
      },
      id: "webhook-trigger-06",
      name: "Webhook Trigger",
      type: "n8n-nodes-base.webhook",
      typeVersion: 2,
      position: [ 100, 200 ],
      webhookId: "chat-router",
      disabled: false
    },
    {
      parameters: {
        options: {}
      },
      id: "chat-trigger",
      name: "Chat Trigger",
      type: "@n8n/n8n-nodes-langchain.chatTrigger",
      typeVersion: 1.1,
      position: [ 100, 400 ],
      disabled: false
    },
    {
      parameters: {
        jsCode: preRouterJsCode
      },
      id: "pre-router-guard",
      name: "Pre-Router Guard & Normalization",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [ 340, 300 ],
      disabled: false
    },
    {
      parameters: {
        rules: {
          values: [
            {
              conditions: {
                options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 },
                conditions: [
                  {
                    leftValue: "={{ $json.is_deterministic }}",
                    rightValue: true,
                    operator: { type: "boolean", operation: "equals" }
                  }
                ],
                combinator: "and"
              }
            }
          ]
        },
        options: { fallbackOutput: "extra" }
      },
      id: "switch-deterministic",
      name: "Check Deterministic Match",
      type: "n8n-nodes-base.switch",
      typeVersion: 3.2,
      position: [ 580, 300 ],
      disabled: false
    },
    {
      parameters: {
        method: "POST",
        url: "http://host.docker.internal:11434/api/generate",
        sendBody: true,
        specifyBody: "json",
        jsonBody: "={\n  \"model\": \"qwen3.5:9b\",\n  \"prompt\": {{ JSON.stringify(\"Sen bir yönetim asistanı niyet sınıflandırıcısısın. Kullanıcı mesajını şu kategorilerden birine ata: HR_POLICY, ATTENDANCE_SQL, COMPANY_KNOWLEDGE, PROJECT_MAIL, HYBRID, SMALL_TALK, HELP, UNKNOWN, SECURITY_REJECTED.\\n\\nKategoriler:\\n- HR_POLICY: Şirket İK politikaları, izin hakları, kıyafet kuralı, yemek/servis yardımı, deneme süresi, bordro.\\n- ATTENDANCE_SQL: Bugün/belirli tarihte kimler geldi, geç kaldı, fabrikada, izinli veya uzaktan çalışıyor.\\n- COMPANY_KNOWLEDGE: Şirket nedir, NISO/Eldor faaliyet alanları, fabrika adresi.\\n- PROJECT_MAIL: TEMSA, Vortex, Eldor OBC, Smart Factory gibi projelerin e-postaları, sprint durumu, teknik blokajlar, teslim tarihleri.\\n- HYBRID: Hem puantaj/katılım hem de proje/aksiyon konularını birlikte soran sorular.\\n- SMALL_TALK: Selamlaşma, hâl hatır sorma, teşekkür, vedalaşma.\\n- HELP: Sistemin yetenekleri ve nasıl kullanılacağı hakkında sorular.\\n- UNKNOWN: Şiir, hava durumu, yemek tarifi veya şirketle alakasız konular.\\n\\nSADECE JSON döndür: {\\\"intent\\\": \\\"...\\\", \\\"confidence\\\": 0.95}\\n\\nMESAJ: \" + $json.question + \"\\n\\nJSON:\") }},\n  \"stream\": false,\n  \"options\": {\n    \"temperature\": 0.1\n  }\n}",
        options: {}
      },
      id: "intent-classifier",
      name: "Qwen3.5-9B Intent Classifier",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [ 800, 450 ],
      disabled: false
    },
    {
      parameters: {
        jsCode: postLlmValidatorJsCode
      },
      id: "post-llm-validator",
      name: "Post-LLM Intent Validator",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [ 1020, 450 ],
      disabled: false
    },
    {
      parameters: {
        rules: {
          values: [
            {
              conditions: {
                options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 },
                conditions: [
                  { leftValue: "={{ $json.intent }}", rightValue: "HR_POLICY", operator: { type: "string", operation: "equals" } }
                ],
                combinator: "and"
              }
            },
            {
              conditions: {
                options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 },
                conditions: [
                  { leftValue: "={{ $json.intent }}", rightValue: "ATTENDANCE_SQL", operator: { type: "string", operation: "equals" } }
                ],
                combinator: "and"
              }
            },
            {
              conditions: {
                options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 },
                conditions: [
                  { leftValue: "={{ $json.intent }}", rightValue: "PROJECT_MAIL", operator: { type: "string", operation: "equals" } }
                ],
                combinator: "and"
              }
            },
            {
              conditions: {
                options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 },
                conditions: [
                  { leftValue: "={{ $json.intent }}", rightValue: "HYBRID", operator: { type: "string", operation: "equals" } }
                ],
                combinator: "and"
              }
            },
            {
              conditions: {
                options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 },
                conditions: [
                  { leftValue: "={{ $json.intent }}", rightValue: "COMPANY_KNOWLEDGE", operator: { type: "string", operation: "equals" } }
                ],
                combinator: "and"
              }
            }
          ]
        },
        options: { fallbackOutput: "extra" }
      },
      id: "switch-main-route",
      name: "Switch Main Route",
      type: "n8n-nodes-base.switch",
      typeVersion: 3.2,
      position: [ 1260, 300 ],
      disabled: false
    },
    {
      parameters: {
        workflowId: {
          __rl: true,
          value: "X48s6TzlpKpVNu2w",
          mode: "list",
          cachedResultUrl: "/workflow/X48s6TzlpKpVNu2w",
          cachedResultName: "07_HR_Hybrid_CAG_RAG_Answer"
        },
        workflowInputs: {
          mappingMode: "passthrough"
        },
        options: { waitForSubWorkflow: true }
      },
      id: "exec-hr-hybrid",
      name: "Execute Sub-Workflow HR Hybrid",
      type: "n8n-nodes-base.executeWorkflow",
      typeVersion: 1.3,
      position: [ 1560, 100 ],
      disabled: false
    },
    {
      parameters: {
        workflowId: {
          __rl: true,
          value: "DowKEdcS2nQbR1wc",
          mode: "list",
          cachedResultUrl: "/workflow/DowKEdcS2nQbR1wc",
          cachedResultName: "09_Secure_Text_to_SQL"
        },
        workflowInputs: {
          mappingMode: "passthrough"
        },
        options: { waitForSubWorkflow: true }
      },
      id: "exec-attendance-sql",
      name: "Execute Sub-Workflow Attendance SQL",
      type: "n8n-nodes-base.executeWorkflow",
      typeVersion: 1.3,
      position: [ 1560, 240 ],
      disabled: false
    },
    {
      parameters: {
        workflowId: {
          __rl: true,
          value: "aopNq0brScuCKrU7",
          mode: "list",
          cachedResultUrl: "/workflow/aopNq0brScuCKrU7",
          cachedResultName: "11_Project_Mail_RAG_Answer"
        },
        workflowInputs: {
          mappingMode: "passthrough"
        },
        options: { waitForSubWorkflow: true }
      },
      id: "exec-project-mail-rag",
      name: "Execute Sub-Workflow Project Mail RAG",
      type: "n8n-nodes-base.executeWorkflow",
      typeVersion: 1.3,
      position: [ 1560, 380 ],
      disabled: false
    },
    {
      parameters: {
        workflowId: {
          __rl: true,
          value: "uSevqGz9uojM7OM7",
          mode: "list",
          cachedResultUrl: "/workflow/uSevqGz9uojM7OM7",
          cachedResultName: "11_Hybrid_Evidence_Merger"
        },
        workflowInputs: {
          mappingMode: "passthrough"
        },
        options: { waitForSubWorkflow: true }
      },
      id: "exec-hybrid-merger",
      name: "Execute Sub-Workflow Hybrid Evidence Merger",
      type: "n8n-nodes-base.executeWorkflow",
      typeVersion: 1.3,
      position: [ 1560, 520 ],
      disabled: false
    },
    {
      parameters: {
        workflowId: {
          __rl: true,
          value: "BK5fKY49Tezk6hZq",
          mode: "list",
          cachedResultUrl: "/workflow/BK5fKY49Tezk6hZq",
          cachedResultName: "10_Company_Knowledge_RAG_Answer"
        },
        workflowInputs: {
          mappingMode: "passthrough"
        },
        options: { waitForSubWorkflow: true }
      },
      id: "exec-company-knowledge",
      name: "Execute Sub-Workflow Company Knowledge",
      type: "n8n-nodes-base.executeWorkflow",
      typeVersion: 1.3,
      position: [ 1560, 660 ],
      disabled: false
    },
    {
      parameters: {
        jsCode: unifiedFormatterJsCode
      },
      id: "unified-formatter",
      name: "Unified Response Formatter",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [ 1860, 300 ],
      disabled: false
    },
    {
      parameters: {
        respondWith: "firstIncomingItem",
        options: {}
      },
      id: "respond-to-webhook",
      name: "Respond to Webhook",
      type: "n8n-nodes-base.respondToWebhook",
      typeVersion: 1.1,
      position: [ 2100, 200 ],
      disabled: false
    },
    {
      parameters: {
        operation: "executeQuery",
        query: "INSERT INTO audit.chat_request (\n  request_id, session_id, question, intent,\n  confidence, status, latency_ms, metadata, created_at\n) VALUES (\n  $1::uuid,\n  $2::text,\n  $3::text,\n  $4::text,\n  $5::numeric,\n  $6::text,\n  $7::int,\n  $8::jsonb,\n  now()\n)\nRETURNING request_id, created_at;",
        options: {
          queryReplacement: "={{ [ $json.request_id, $json.session_id, $json.answer ? $json.intent : 'EMPTY', $json.intent, $json.confidence, $json.status, 25, JSON.stringify({ route_used: $json.route_used, retrieval_used: $json.retrieval_used, source_count: $json.source_count }) ] }}"
        }
      },
      id: "audit-postgres",
      name: "Audit Log to Postgres",
      type: "n8n-nodes-base.postgres",
      typeVersion: 2.7,
      position: [ 2100, 400 ],
      credentials: {
        postgres: {
          id: "postgresManagementAi01",
          name: "PostgreSQL Management AI"
        }
      },
      disabled: false
    }
  ],
  connections: {
    "Webhook Trigger": {
      main: [
        [ { node: "Pre-Router Guard & Normalization", type: "main", index: 0 } ]
      ]
    },
    "Chat Trigger": {
      main: [
        [ { node: "Pre-Router Guard & Normalization", type: "main", index: 0 } ]
      ]
    },
    "Pre-Router Guard & Normalization": {
      main: [
        [ { node: "Check Deterministic Match", type: "main", index: 0 } ]
      ]
    },
    "Check Deterministic Match": {
      main: [
        [ { node: "Switch Main Route", type: "main", index: 0 } ],
        [ { node: "Qwen3.5-9B Intent Classifier", type: "main", index: 0 } ]
      ]
    },
    "Qwen3.5-9B Intent Classifier": {
      main: [
        [ { node: "Post-LLM Intent Validator", type: "main", index: 0 } ]
      ]
    },
    "Post-LLM Intent Validator": {
      main: [
        [ { node: "Switch Main Route", type: "main", index: 0 } ]
      ]
    },
    "Switch Main Route": {
      main: [
        [ { node: "Execute Sub-Workflow HR Hybrid", type: "main", index: 0 } ],
        [ { node: "Execute Sub-Workflow Attendance SQL", type: "main", index: 0 } ],
        [ { node: "Execute Sub-Workflow Project Mail RAG", type: "main", index: 0 } ],
        [ { node: "Execute Sub-Workflow Hybrid Evidence Merger", type: "main", index: 0 } ],
        [ { node: "Execute Sub-Workflow Company Knowledge", type: "main", index: 0 } ],
        [ { node: "Unified Response Formatter", type: "main", index: 0 } ]
      ]
    },
    "Execute Sub-Workflow HR Hybrid": {
      main: [ [ { node: "Unified Response Formatter", type: "main", index: 0 } ] ]
    },
    "Execute Sub-Workflow Attendance SQL": {
      main: [ [ { node: "Unified Response Formatter", type: "main", index: 0 } ] ]
    },
    "Execute Sub-Workflow Project Mail RAG": {
      main: [ [ { node: "Unified Response Formatter", type: "main", index: 0 } ] ]
    },
    "Execute Sub-Workflow Hybrid Evidence Merger": {
      main: [ [ { node: "Unified Response Formatter", type: "main", index: 0 } ] ]
    },
    "Execute Sub-Workflow Company Knowledge": {
      main: [ [ { node: "Unified Response Formatter", type: "main", index: 0 } ] ]
    },
    "Unified Response Formatter": {
      main: [
        [
          { node: "Respond to Webhook", type: "main", index: 0 },
          { node: "Audit Log to Postgres", type: "main", index: 0 }
        ]
      ]
    }
  },
  settings: {
    executionOrder: "v1"
  }
};

fs.writeFileSync(path.join(__dirname, '..', 'n8n_06_chat_intent_router_workflow.json'), JSON.stringify(workflow06, null, 2), 'utf8');
console.log('Successfully generated n8n_06_chat_intent_router_workflow.json');
