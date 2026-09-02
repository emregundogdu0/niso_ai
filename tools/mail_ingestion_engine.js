const { execSync } = require('child_process');
const crypto = require('crypto');

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const EMBEDDING_MODEL = 'qwen3-embedding:0.6b';
const LLM_MODEL = 'qwen3.5:9b';

// Known Project Vocabulary / Dictionary
const PROJECT_DICTIONARY = [
  { code: 'PRJ-TEMSA', name: 'TEMSA Elektrikli Otobüs Projesi', aliases: ['temsa', 'temsa projesi', 'temsa ecu'] },
  { code: 'PRJ-VORTEX', name: 'Vortex AI Engine Otonom Araç Projesi', aliases: ['vortex', 'vortex ai', 'ugv platform', 'jetson otonomi'] },
  { code: 'PRJ-ELDOR-OBC', name: 'Eldor On-Board Charger Güç Elektroniği', aliases: ['eldor obc', 'on-board charger', 'obc projesi', 'eldor charger'] },
  { code: 'PRJ-SMART-FACTORY', name: 'NISO Akıllı Fabrika & Üretim İzleme', aliases: ['akıllı fabrika', 'üretim izleme', 'kestirimci bakım', 'smart factory'] },
  { code: 'PRJ-AUTOSAR-ECU', name: 'AUTOSAR ECU & Adaptive Platform', aliases: ['autosar', 'autosar ecu', 'adaptive autosar', 'ecu middleware'] },
  { code: 'PRJ-INTERNAL-HR', name: 'NISO İK & Yönetim Operasyonları', aliases: ['ik operasyon', 'bordro', 'çalışan uygulaması', 'yıllık izin sistemi'] }
];

function runAdminPsql(sqlQuery) {
  return execSync('docker exec -i management-postgres psql -U management_admin -d management_ai -q -X', {
    input: Buffer.from(sqlQuery, 'utf8'),
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024
  });
}

function runAdminPsqlJson(sqlQuery) {
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
}

async function getEmbedding(text) {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      prompt: text.substring(0, 3000)
    })
  });
  if (!response.ok) {
    throw new Error(`Embedding generation error: ${response.statusText}`);
  }
  const data = await response.json();
  return data.embedding;
}

// 1. Schema Validator
function validateCommonMailSchema(msg) {
  const required = ['provider', 'provider_message_id', 'from_address', 'subject'];
  for (const f of required) {
    if (!msg[f]) {
      return { valid: false, reason: `Eksik zorunlu alan: ${f}` };
    }
  }
  if (!['GMAIL', 'OUTLOOK'].includes(msg.provider)) {
    return { valid: false, reason: `Geçersiz e-posta sağlayıcısı: ${msg.provider}` };
  }
  return { valid: true };
}

// 2. Active Mailbox Source Check
function validateActiveMailboxSource(provider, mailboxAddress) {
  const safeProvider = provider.replace(/'/g, "''");
  let sql = `SELECT * FROM mail.mailbox_source WHERE provider = '${safeProvider}' AND is_active = true`;
  if (mailboxAddress) {
    sql += ` AND LOWER(mailbox_address) = '${mailboxAddress.toLowerCase().replace(/'/g, "''")}'`;
  }
  const rows = runAdminPsqlJson(sql);
  if (!rows || rows.length === 0) {
    return { active: false, reason: `Sağlayıcı veya posta kutusu aktif değil: ${provider} (${mailboxAddress || 'Belirtilmemiş'})` };
  }
  return { active: true, source: rows[0] };
}

// 3. Address & Delivery Mode Normalizer
function detectDeliveryMode(msg) {
  const botMail = (msg.mailbox_address || '').toLowerCase();
  const toList = (msg.to_addresses || []).map(a => String(a).toLowerCase());
  const ccList = (msg.cc_addresses || []).map(a => String(a).toLowerCase());
  const subject = (msg.subject || '').toLowerCase();
  const body = (msg.plain_text_body || msg.html_body || '').toLowerCase();

  // Forward check
  if (subject.startsWith('fwd:') || subject.startsWith('ilt:') || subject.startsWith('fw:') || body.includes('---------- forwarded message ---------') || body.includes('kimden:') || body.includes('iletilen ileti')) {
    return 'FORWARDED';
  }

  // Reply check
  if (subject.startsWith('re:') || subject.startsWith('ynt:') || subject.startsWith('yanıt:') || msg.in_reply_to) {
    return 'REPLY_THREAD';
  }

  // Direct TO
  if (toList.some(a => a.includes(botMail))) {
    return 'DIRECT_TO';
  }

  // CC
  if (ccList.some(a => a.includes(botMail))) {
    return 'CC';
  }

  // Undisclosed / BCC
  if (botMail && !toList.some(a => a.includes(botMail)) && !ccList.some(a => a.includes(botMail))) {
    return 'BCC_OR_UNDISCLOSED';
  }

  return 'UNKNOWN_DELIVERY';
}

// 4. HTML to Clean Text & Separator
function cleanHtmlAndExtractText(html, plainText) {
  let text = plainText || '';
  if (!text && html) {
    text = html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*[\/]?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"');
  }

  // Separate Signature
  const signaturePatterns = [
    /\n--\s*\n[\s\S]*$/,
    /\nSaygılarımla,[\s\S]*$/i,
    /\nİyi çalışmalar,[\s\S]*$/i,
    /\nBest regards,[\s\S]*$/i,
    /\nTeşekkürler,[\s\S]*$/i,
    /\nSent from my iPhone[\s\S]*$/i
  ];
  let bodyWithoutSig = text;
  for (const pat of signaturePatterns) {
    bodyWithoutSig = bodyWithoutSig.replace(pat, '');
  }

  // Separate Quoted Thread
  const quoteSplitters = [
    /\nOn .* wrote:[\s\S]*$/i,
    /\n.* tarihinde .* yazdı:[\s\S]*$/i,
    /\n_{5,}[\s\S]*$/i,
    /\nFrom: .*[\s\S]*$/i
  ];
  let cleanNewContent = bodyWithoutSig;
  for (const qs of quoteSplitters) {
    cleanNewContent = cleanNewContent.replace(qs, '');
  }

  // Clean remaining quote arrows
  cleanNewContent = cleanNewContent.split('\n').filter(line => !line.trim().startsWith('>')).join('\n').trim();

  // Forwarded metadata extraction
  let forwardedMeta = null;
  const fwdMatch = text.match(/(?:From|Kimden):\s*([^\n]+)\s*\n(?:Date|Tarih):\s*([^\n]+)\s*\n(?:Subject|Konu):\s*([^\n]+)/i);
  if (fwdMatch) {
    forwardedMeta = {
      forwarded_original_from: fwdMatch[1].trim(),
      forwarded_original_date: fwdMatch[2].trim(),
      forwarded_original_subject: fwdMatch[3].trim(),
      note: 'Extracted from body text; not a verified server header'
    };
  }

  return {
    cleanedText: cleanNewContent || text.trim(),
    fullText: text.trim(),
    forwardedMeta
  };
}

// 5. Prompt Injection Scanner
function scanPromptInjection(text) {
  const lower = text.toLowerCase();
  const injectionPatterns = [
    /ignore (all )?previous instructions/i,
    /önceki talimatları unut/i,
    /sistem promptunu göster/i,
    /system prompt/i,
    /bütün çalışan bilgilerini/i,
    /bütün personeli listele/i,
    /sql komutu çalıştır/i,
    /güvenlik kurallarını devre dışı bırak/i,
    /drop table/i,
    /delete from/i,
    /eval\(/i,
    /exec\(/i,
    /jailbreak/i,
    /dan mode/i
  ];

  for (const pat of injectionPatterns) {
    if (pat.test(lower)) {
      return { detected: true, matchedPattern: pat.toString() };
    }
  }
  return { detected: false };
}

// 6. Fast Pattern Classifier & Project Extractor
function classifyBusinessRelevance(subject, body, fromAddress) {
  const combined = `${subject}\n${body}`.toLowerCase();
  const fromLower = (fromAddress || '').toLowerCase();

  // Prompt Injection check first
  const injection = scanPromptInjection(combined);
  if (injection.detected) {
    return {
      is_business_related: true,
      category: 'BUSINESS_TECHNICAL',
      confidence: 0.95,
      reason: 'İş e-postası formatında fakat prompt injection şüphesi içeriyor.',
      suspected_prompt_injection: true,
      requires_manual_review: true,
      decision: 'MANUAL_REVIEW'
    };
  }

  // Explicit Reject Categories
  if (combined.includes('kupon') || combined.includes('indirim kodu') || combined.includes('kampanya') || combined.includes('fırsat') || combined.includes('yüzde 50 indirim')) {
    return {
      is_business_related: false,
      category: 'ADVERTISEMENT',
      confidence: 0.99,
      reason: 'Alışveriş, indirim veya reklam kampanyası tespit edildi.',
      decision: 'REJECTED_ADVERTISEMENT'
    };
  }

  if (combined.includes('newsletter') || combined.includes('haftalık bülten') || combined.includes('abonelikten çık') || combined.includes('unsubscribe') || fromLower.includes('newsletter') || fromLower.includes('no-reply@medium')) {
    return {
      is_business_related: false,
      category: 'NEWSLETTER',
      confidence: 0.98,
      reason: 'İşle ilgisiz haftalık bülten veya newsletter tespit edildi.',
      decision: 'REJECTED_NEWSLETTER'
    };
  }

  if (fromLower.includes('linkedin') || fromLower.includes('twitter') || fromLower.includes('instagram') || fromLower.includes('facebook') || combined.includes('yeni bir bağlantı isteği') || combined.includes('profilinizi görüntüledi')) {
    return {
      is_business_related: false,
      category: 'SOCIAL_NOTIFICATION',
      confidence: 0.99,
      reason: 'Sosyal medya bildirimi tespit edildi.',
      decision: 'REJECTED_SOCIAL'
    };
  }

  if (combined.includes('siparişiniz kargoya verildi') || combined.includes('sipariş onaylandı') || combined.includes('teslimat adresi') || fromLower.includes('trendyol') || fromLower.includes('hepsiburada') || fromLower.includes('amazon.com.tr')) {
    return {
      is_business_related: false,
      category: 'PERSONAL',
      confidence: 0.98,
      reason: 'Kişisel e-ticaret veya kargo sipariş bildirimi.',
      decision: 'REJECTED_PERSONAL'
    };
  }

  if (combined.includes('tebrikler kazandınız') || combined.includes('hesabınız askıya alındı') || combined.includes('şifrenizi sıfırlamak için tıklayın') || combined.includes('urgent transfer money') || combined.includes('crypto bonus')) {
    return {
      is_business_related: false,
      category: 'SPAM_OR_SUSPICIOUS',
      confidence: 0.99,
      reason: 'Spam veya şüpheli kimlik avı (phishing) içeriği tespit edildi.',
      decision: 'REJECTED_SPAM'
    };
  }

  if (combined.includes('sinema bileti') || combined.includes('konser bileti') || combined.includes('tatil fırsatları') || fromLower.includes('netflix') || fromLower.includes('biletix')) {
    return {
      is_business_related: false,
      category: 'ADVERTISEMENT',
      confidence: 0.98,
      reason: 'Eğlence veya etkinlik reklamı tespit edildi.',
      decision: 'REJECTED_ADVERTISEMENT'
    };
  }

  // Business Categories & Project Extraction
  let matchedProject = null;
  for (const prj of PROJECT_DICTIONARY) {
    if (prj.aliases.some(alias => combined.includes(alias))) {
      matchedProject = prj;
      break;
    }
  }

  // Meeting
  if (combined.includes('toplantı notları') || combined.includes('toplantı özeti') || combined.includes('meeting minutes') || combined.includes('gündem maddeleri')) {
    return {
      is_business_related: true,
      category: 'BUSINESS_MEETING',
      confidence: 0.98,
      reason: 'Proje veya operasyon toplantı notları/gündemi içeriyor.',
      project_code: matchedProject ? matchedProject.code : 'UNKNOWN_PROJECT',
      project_name: matchedProject ? matchedProject.name : null,
      contains_decision: combined.includes('karar') || combined.includes('mutabık'),
      contains_action: combined.includes('aksiyon') || combined.includes('sorumlu'),
      decision: 'ACCEPTED_BUSINESS'
    };
  }

  // Task & Assignee
  if (combined.includes('görev') || combined.includes('sorumlu') || combined.includes('task') || combined.includes('jira') || combined.includes('ataması yapıldı')) {
    return {
      is_business_related: true,
      category: 'BUSINESS_TASK',
      confidence: 0.97,
      reason: 'Görev ataması veya iş takip maddeleri içeriyor.',
      project_code: matchedProject ? matchedProject.code : 'UNKNOWN_PROJECT',
      project_name: matchedProject ? matchedProject.name : null,
      contains_action: true,
      decision: 'ACCEPTED_BUSINESS'
    };
  }

  // Technical Issue / Bug / Anomaly
  if (combined.includes('teknik sorun') || combined.includes('arıza') || /(?:^|[^\p{L}\p{N}])bug(?:[^\p{L}\p{N}]|$)/iu.test(combined) || combined.includes('hata raporu') || combined.includes('canlı ortam hatası') || combined.includes('log analizi')) {
    return {
      is_business_related: true,
      category: 'BUSINESS_TECHNICAL',
      confidence: 0.98,
      reason: 'Teknik hata bildirimi veya sistem arıza kaydı içeriyor.',
      project_code: matchedProject ? matchedProject.code : 'UNKNOWN_PROJECT',
      project_name: matchedProject ? matchedProject.name : null,
      contains_risk: true,
      decision: 'ACCEPTED_BUSINESS'
    };
  }

  // Risk or Blocker
  if (combined.includes('risk') || combined.includes('blokaj') || combined.includes('gecikme riski') || combined.includes('tedarik sorunu')) {
    return {
      is_business_related: true,
      category: 'BUSINESS_PROJECT',
      confidence: 0.98,
      reason: 'Proje ilerlemesi veya teslimat riski içeriyor.',
      project_code: matchedProject ? matchedProject.code : 'UNKNOWN_PROJECT',
      project_name: matchedProject ? matchedProject.name : null,
      contains_risk: true,
      decision: 'ACCEPTED_BUSINESS'
    };
  }

  // Deadline / Delivery Date
  if (combined.includes('teslim tarihi') || combined.includes('deadline') || combined.includes('sürüm yayını') || combined.includes('milestone')) {
    return {
      is_business_related: true,
      category: 'BUSINESS_PROJECT',
      confidence: 0.98,
      reason: 'Proje teslim tarihi veya milestone takvimi içeriyor.',
      project_code: matchedProject ? matchedProject.code : 'UNKNOWN_PROJECT',
      project_name: matchedProject ? matchedProject.name : null,
      contains_deadline: true,
      decision: 'ACCEPTED_BUSINESS'
    };
  }

  // Internal Operations
  if (combined.includes('şirket içi operasyon') || combined.includes('sunucu bakımı') || combined.includes('ofis düzeni') || combined.includes('it altyapı') || combined.includes('sistem güncellemesi')) {
    return {
      is_business_related: true,
      category: 'BUSINESS_OPERATION',
      confidence: 0.96,
      reason: 'Şirket içi IT/Operasyonel duyuru veya bakım bilgisi.',
      project_code: 'PRJ-INTERNAL-HR',
      project_name: 'NISO İç Operasyon',
      decision: 'ACCEPTED_BUSINESS'
    };
  }

  // HR & Employee Relations
  if (combined.includes('özlük hakları') || combined.includes('iş güvenliği') || combined.includes('ik görüşmesi') || combined.includes('izin talepleri') || combined.includes('yan haklar') || combined.includes('bordro')) {
    return {
      is_business_related: true,
      category: 'BUSINESS_HR',
      confidence: 0.97,
      reason: 'Şirket içi İK, özlük hakları veya çalışan ilişkileri iletişimi.',
      project_code: 'PRJ-INTERNAL-HR',
      project_name: 'NISO İK & Yönetim',
      decision: 'ACCEPTED_BUSINESS'
    };
  }

  // General Business Project Update
  if (matchedProject || combined.includes('proje') || combined.includes('durum güncellemesi') || combined.includes('haftalık ilerleme') || combined.includes('müşteri toplantısı')) {
    return {
      is_business_related: true,
      category: 'BUSINESS_PROJECT',
      confidence: 0.95,
      reason: 'Kurumsal proje durum güncellemesi veya iş iletişimi.',
      project_code: matchedProject ? matchedProject.code : 'UNKNOWN_PROJECT',
      project_name: matchedProject ? matchedProject.name : null,
      decision: 'ACCEPTED_BUSINESS'
    };
  }

  // Low confidence / Unclear
  return {
    is_business_related: false,
    category: 'UNKNOWN',
    confidence: 0.60,
    reason: 'İçerik net bir iş kategorisiyle eşleştirilemedi.',
    requires_manual_review: true,
    decision: 'MANUAL_REVIEW'
  };
}

// 7. Core 25-Step Pipeline
async function ingestCommonMail(rawMsg) {
  const startTime = Date.now();
  const eventId = crypto.randomUUID();

  // Step 1: Validate Common Message Schema
  const schemaVal = validateCommonMailSchema(rawMsg);
  if (!schemaVal.valid) {
    return {
      id: eventId,
      provider: rawMsg.provider || 'UNKNOWN',
      decision: 'PROCESSING_ERROR',
      reason: schemaVal.reason,
      latency_ms: Date.now() - startTime
    };
  }

  const provider = rawMsg.provider;
  const mailboxAddress = (rawMsg.mailbox_address || '').toLowerCase();
  const providerMsgId = rawMsg.provider_message_id;
  const internetMsgId = rawMsg.internet_message_id || null;
  const fromAddr = rawMsg.from_address;
  const toList = rawMsg.to_addresses || [];
  const ccList = rawMsg.cc_addresses || [];
  const subject = rawMsg.subject || '(Başlıksız)';
  const receivedAt = rawMsg.received_at ? new Date(rawMsg.received_at).toISOString() : new Date().toISOString();

  // Step 2: Validate Active Mailbox Source
  const sourceVal = validateActiveMailboxSource(provider, mailboxAddress);
  if (!sourceVal.active) {
    return {
      id: eventId,
      provider,
      mailbox_address: mailboxAddress,
      provider_message_id: providerMsgId,
      decision: 'PROCESSING_ERROR',
      reason: sourceVal.reason,
      latency_ms: Date.now() - startTime
    };
  }

  // Step 3: Provider-Level Deduplication Check
  const providerDupSql = `
    SELECT id, decision FROM mail.ingestion_event 
    WHERE provider = '${provider}' AND mailbox_address = '${mailboxAddress.replace(/'/g, "''")}' AND provider_message_id = '${providerMsgId.replace(/'/g, "''")}';
  `;
  const existingProviderDup = runAdminPsqlJson(providerDupSql);
  if (existingProviderDup.length > 0) {
    const existing = existingProviderDup[0];
    const dupAuditInsert = `
      INSERT INTO mail.ingestion_event (
        id, provider, mailbox_address, provider_message_id, provider_thread_id,
        internet_message_id, from_address, to_addresses, cc_addresses, subject,
        received_at, delivery_mode, is_business_related, classification,
        classification_confidence, decision, reason, content_hash, metadata, processed_at
      ) VALUES (
        '${eventId}', '${provider}', '${mailboxAddress.replace(/'/g, "''")}', '${providerMsgId.replace(/'/g, "''")}_dup',
        ${rawMsg.provider_thread_id ? `'${rawMsg.provider_thread_id.replace(/'/g, "''")}'` : 'NULL'},
        ${internetMsgId ? `'${internetMsgId.replace(/'/g, "''")}'` : 'NULL'},
        '${fromAddr.replace(/'/g, "''")}', '${JSON.stringify(toList)}'::jsonb, '${JSON.stringify(ccList)}'::jsonb,
        '${subject.replace(/'/g, "''")}', '${receivedAt}', 'DUPLICATE_ATTEMPT', false, 'DUPLICATE',
        1.000, 'DUPLICATE', 'Sağlayıcı mesaj ID zaten işlenmiş (Önceki kayıt ID: ${existing.id})',
        '${crypto.createHash('sha256').update(subject + fromAddr, 'utf8').digest('hex')}', '{}'::jsonb, now()
      );
    `;
    try { runAdminPsql(dupAuditInsert); } catch (e) {}

    return {
      id: eventId,
      provider,
      mailbox_address: mailboxAddress,
      provider_message_id: providerMsgId,
      decision: 'DUPLICATE',
      reason: `Sağlayıcı mesaj ID zaten işlenmiş: ${providerMsgId}`,
      latency_ms: Date.now() - startTime
    };
  }

  // Step 4: HTML Cleaning, Signature & Quoted Thread Separation
  const { cleanedText, fullText, forwardedMeta } = cleanHtmlAndExtractText(rawMsg.html_body, rawMsg.plain_text_body);

  // Step 5: Content Hash Calculation
  const hashInput = `${subject.toLowerCase().trim()}|${cleanedText.toLowerCase().trim()}`;
  const contentHash = crypto.createHash('sha256').update(hashInput, 'utf8').digest('hex');

  // Step 6: Cross-Provider Deduplication Check
  let crossDupCheckSql = `
    SELECT id, provider, decision FROM mail.ingestion_event 
    WHERE content_hash = '${contentHash}'
  `;
  if (internetMsgId) {
    crossDupCheckSql += ` OR internet_message_id = '${internetMsgId.replace(/'/g, "''")}'`;
  }
  const existingCrossDup = runAdminPsqlJson(crossDupCheckSql);
  if (existingCrossDup.length > 0) {
    const existing = existingCrossDup[0];
    const auditInsert = `
      INSERT INTO mail.ingestion_event (
        id, provider, mailbox_address, provider_message_id, provider_thread_id,
        internet_message_id, from_address, to_addresses, cc_addresses, subject,
        received_at, delivery_mode, is_business_related, classification,
        classification_confidence, decision, reason, content_hash, metadata, processed_at
      ) VALUES (
        '${eventId}', '${provider}', '${mailboxAddress.replace(/'/g, "''")}', '${providerMsgId.replace(/'/g, "''")}',
        ${rawMsg.provider_thread_id ? `'${rawMsg.provider_thread_id.replace(/'/g, "''")}'` : 'NULL'},
        ${internetMsgId ? `'${internetMsgId.replace(/'/g, "''")}'` : 'NULL'},
        '${fromAddr.replace(/'/g, "''")}', '${JSON.stringify(toList)}'::jsonb, '${JSON.stringify(ccList)}'::jsonb,
        '${subject.replace(/'/g, "''")}', '${receivedAt}', 'CROSS_PROVIDER_DUP', false, 'DUPLICATE',
        1.000, 'DUPLICATE', 'Çapraz sağlayıcı veya içerik kopyası tespit edildi (Önceki kayıt ID: ${existing.id})',
        '${contentHash}', '{}'::jsonb, now()
      );
    `;
    runAdminPsql(auditInsert);

    return {
      id: eventId,
      provider,
      mailbox_address: mailboxAddress,
      provider_message_id: providerMsgId,
      decision: 'DUPLICATE',
      reason: `Çapraz sağlayıcı kopyası tespit edildi (Önceki kayıt: ${existing.provider} - ID: ${existing.id})`,
      content_hash: contentHash,
      latency_ms: Date.now() - startTime
    };
  }

  // Step 7: Delivery Mode Detection
  const deliveryMode = detectDeliveryMode(rawMsg);

  // Step 8: Business Relevance Classification & Project Metadata
  const classification = classifyBusinessRelevance(subject, cleanedText, fromAddr);

  const isBusiness = classification.is_business_related;
  const decision = classification.decision;
  const projectCode = classification.project_code || null;
  const suspectedInjection = Boolean(classification.suspected_prompt_injection);
  const requiresManualReview = Boolean(classification.requires_manual_review);

  const auditMetadata = {
    delivery_mode: deliveryMode,
    forwarded_metadata: forwardedMeta,
    contains_action: classification.contains_action || false,
    contains_decision: classification.contains_decision || false,
    contains_risk: classification.contains_risk || false,
    contains_deadline: classification.contains_deadline || false,
    attachment_count: (rawMsg.attachment_metadata || []).length
  };

  // Step 9: Audit Ingestion Event
  const insertAuditSql = `
    INSERT INTO mail.ingestion_event (
      id, provider, mailbox_address, provider_message_id, provider_thread_id,
      internet_message_id, from_address, to_addresses, cc_addresses, subject,
      received_at, delivery_mode, labels_or_categories, is_business_related,
      classification, classification_confidence, decision, reason, project_code,
      content_hash, suspected_prompt_injection, requires_manual_review, metadata, processed_at
    ) VALUES (
      '${eventId}', '${provider}', '${mailboxAddress.replace(/'/g, "''")}', '${providerMsgId.replace(/'/g, "''")}',
      ${rawMsg.provider_thread_id ? `'${rawMsg.provider_thread_id.replace(/'/g, "''")}'` : 'NULL'},
      ${internetMsgId ? `'${internetMsgId.replace(/'/g, "''")}'` : 'NULL'},
      '${fromAddr.replace(/'/g, "''")}', '${JSON.stringify(toList)}'::jsonb, '${JSON.stringify(ccList)}'::jsonb,
      '${subject.replace(/'/g, "''")}', '${receivedAt}', '${deliveryMode}',
      '${JSON.stringify(rawMsg.labels_or_categories || [])}'::jsonb, ${isBusiness},
      '${classification.category}', ${classification.confidence}, '${decision}',
      '${classification.reason.replace(/'/g, "''")}', ${projectCode ? `'${projectCode}'` : 'NULL'},
      '${contentHash}', ${suspectedInjection}, ${requiresManualReview},
      '${JSON.stringify(auditMetadata).replace(/'/g, "''")}'::jsonb, now()
    );
  `;
  runAdminPsql(insertAuditSql);

  // Step 10: If ACCEPTED_BUSINESS and NO Prompt Injection -> Vectorize & Store in PGVector
  if (decision === 'ACCEPTED_BUSINESS' && !suspectedInjection) {
    const docId = crypto.randomUUID();
    const docMeta = {
      mailbox_address: mailboxAddress,
      from_address: fromAddr,
      delivery_mode: deliveryMode,
      classification: classification.category,
      forwarded_meta: forwardedMeta,
      project_name: classification.project_name
    };

    const insertDocSql = `
      INSERT INTO rag.document (
        id, source_type, source_provider, external_id, title,
        project_code, sender_address, received_at, content_hash, sensitivity,
        is_active, metadata, created_at
      ) VALUES (
        '${docId}', 'EMAIL', '${provider}', '${providerMsgId.replace(/'/g, "''")}',
        '${subject.replace(/'/g, "''")}', ${projectCode ? `'${projectCode}'` : 'NULL'},
        '${fromAddr.replace(/'/g, "''")}', '${receivedAt}', '${contentHash}',
        'INTERNAL', true, '${JSON.stringify(docMeta).replace(/'/g, "''")}'::jsonb, now()
      );
    `;
    runAdminPsql(insertDocSql);

    // Chunking text (500 tokens / 2000 chars)
    const chunkText = `E-POSTA KONUSU: ${subject}\nGÖNDEREN: ${fromAddr}\nTARİH: ${receivedAt}\nPROJE: ${projectCode || 'Genel'}\n\nİÇERİK:\n${cleanedText}`;
    const embedding = await getEmbedding(chunkText);
    const tokenEst = Math.round(chunkText.length / 4);

    const insertChunkSql = `
      INSERT INTO rag.chunk (
        document_id, chunk_index, content, token_count,
        embedding_model, embedding_dimension, embedding, metadata, created_at
      ) VALUES (
        '${docId}', 0, '${chunkText.replace(/'/g, "''")}', ${tokenEst},
        '${EMBEDDING_MODEL}', 1024, '[${embedding.join(',')}]'::vector,
        '${JSON.stringify({ project_code: projectCode }).replace(/'/g, "''")}'::jsonb, now()
      );
    `;
    runAdminPsql(insertChunkSql);
  }

  const latencyMs = Date.now() - startTime;

  return {
    id: eventId,
    provider,
    mailbox_address: mailboxAddress,
    provider_message_id: providerMsgId,
    subject,
    decision,
    classification: classification.category,
    confidence: classification.confidence,
    project_code: projectCode,
    suspected_prompt_injection: suspectedInjection,
    requires_manual_review: requiresManualReview,
    content_hash: contentHash,
    latency_ms: latencyMs
  };
}

module.exports = {
  ingestCommonMail,
  validateCommonMailSchema,
  validateActiveMailboxSource,
  detectDeliveryMode,
  cleanHtmlAndExtractText,
  scanPromptInjection,
  classifyBusinessRelevance
};
