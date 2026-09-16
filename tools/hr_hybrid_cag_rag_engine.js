const { execSync } = require('child_process');
const crypto = require('crypto');

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const EMBEDDING_MODEL = 'qwen3-embedding:0.6b';
const LLM_MODEL = 'qwen3.5:9b';
const SIMILARITY_THRESHOLD = 0.28;

function runPsqlJson(sqlQuery) {
  const jsonWrapped = `\\t\n\\a\nSELECT json_agg(t) FROM (${sqlQuery}) t;`;
  const result = execSync('docker exec -i management-postgres psql -U management_admin -d management_ai -q -X', {
    input: Buffer.from(jsonWrapped, 'utf8'),
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024
  });
  const trimmed = result.trim();
  if (!trimmed || trimmed === 'null') return [];
  return JSON.parse(trimmed);
}

function runPsql(sqlQuery) {
  return execSync('docker exec -i management-postgres psql -U management_admin -d management_ai -q -X', {
    input: Buffer.from(sqlQuery, 'utf8'),
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024
  });
}

async function getQueryEmbedding(text) {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text
    })
  });
  if (!response.ok) throw new Error(`Ollama embed error: ${response.statusText}`);
  const data = await response.json();
  return data.embeddings[0];
}

async function getActiveCagSnapshot() {
  const rows = runPsqlJson(`
    SELECT id, snapshot_version, content, content_hash, policy_count, token_estimate, source_versions
    FROM hr.policy_snapshot
    WHERE is_active = true
    LIMIT 1
  `);
  return rows.length > 0 ? rows[0] : null;
}

async function retrieveRagChunks(queryEmbedding, topK = 12) {
  const vectorLiteral = `[${queryEmbedding.join(',')}]`;
  const sql = `
    SELECT 
      c.id AS chunk_id,
      d.external_id AS policy_code,
      d.title,
      c.content,
      c.metadata->>'category' AS category,
      c.metadata->>'source_section' AS source_section,
      c.metadata->>'owner' AS owner,
      c.metadata->>'effective_from' AS effective_from,
      c.metadata->>'effective_to' AS effective_to,
      (c.metadata->>'version')::int AS version,
      ROUND((1 - (c.embedding <=> '${vectorLiteral}'::vector))::numeric, 4) AS cosine_similarity,
      ROUND((c.embedding <=> '${vectorLiteral}'::vector)::numeric, 4) AS cosine_distance
    FROM rag.chunk c
    JOIN rag.document d ON c.document_id = d.id
    WHERE d.is_active = true
      AND UPPER(d.source_type) = 'HR_POLICY'
    ORDER BY c.embedding <=> '${vectorLiteral}'::vector ASC
    LIMIT ${topK}
  `;
  return runPsqlJson(sql);
}

function tokenizeForLexical(text) {
  return String(text || '')
    .replace(/İ/g, 'i').replace(/I/g, 'i').replace(/ı/g, 'i')
    .replace(/ç/g, 'c').replace(/Ç/g, 'c').replace(/ğ/g, 'g').replace(/Ğ/g, 'g')
    .replace(/ö/g, 'o').replace(/Ö/g, 'o').replace(/ş/g, 's').replace(/Ş/g, 's')
    .replace(/ü/g, 'u').replace(/Ü/g, 'u')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

async function retrievePoliciesLexical(question, topK = 6) {
  const tokens = tokenizeForLexical(question);
  const expanded = new Set(tokens);

  // Compact variants so "dresscode" still hits Dress code policies.
  if (tokens.some(t => t.includes('dress') || t === 'dresscode' || t === 'kiyafet' || t === 'giyinme' || t === 'giyim')) {
    ['dress', 'code', 'dresscode', 'kiyafet', 'giyin', 'giyim', 'standardi', 'kurali'].forEach(t => expanded.add(t));
  }

  const rows = runPsqlJson(`
    SELECT
      policy_code,
      category,
      canonical_question AS title,
      answer_text AS content,
      source_section,
      owner,
      effective_from::text AS effective_from,
      effective_to::text AS effective_to,
      version
    FROM hr.policy_item
    WHERE approved = true
    ORDER BY policy_code ASC
  `);

  const scored = rows.map((row) => {
    const haystack = tokenizeForLexical([
      row.policy_code,
      row.category,
      row.title,
      row.content,
      row.source_section
    ].join(' '));
    const haySet = new Set(haystack);
    let hits = 0;
    for (const token of expanded) {
      if (haySet.has(token) || haystack.some(h => h.includes(token) || token.includes(h))) hits += 1;
    }
    // Prefer core office dress-code policy for general queries.
    if ((expanded.has('dresscode') || expanded.has('dress') || expanded.has('kiyafet')) && row.policy_code === 'HR-064') {
      hits += 2;
    }
    return {
      chunk_id: row.policy_code,
      policy_code: row.policy_code,
      title: row.title,
      content: `${row.title}\n${row.content}`,
      category: row.category,
      source_section: row.source_section,
      owner: row.owner,
      effective_from: row.effective_from,
      effective_to: row.effective_to,
      version: row.version,
      cosine_similarity: hits > 0 ? Number(Math.min(0.95, 0.45 + hits * 0.08).toFixed(4)) : 0,
      cosine_distance: hits > 0 ? Number((1 - Math.min(0.95, 0.45 + hits * 0.08)).toFixed(4)) : 1
    };
  })
    .filter(r => r.cosine_similarity >= SIMILARITY_THRESHOLD)
    .sort((a, b) => b.cosine_similarity - a.cosine_similarity)
    .slice(0, topK);

  return scored;
}

function formatDeterministicHrAnswer(finalChunks) {
  if (!finalChunks.length) {
    return {
      answer: `**Özet Cevap:**\nBu konuda onaylı şirket İK politikası bulunamadı.\n\n> ℹ️ *Not: Bu sorgu için sistemde onaylı bir İK kuralı veya politika kaydı mevcut değildir.*`,
      route_used: 'NONE',
      sources: [],
      confidence: 0.0,
      synthetic_notice: 'Sentetik Demo Veri'
    };
  }

  const primary = finalChunks[0];
  const detailLines = finalChunks.slice(0, 3).map((c) => {
    const body = String(c.content || '').split('\n').slice(1).join(' ').trim() || c.content;
    return `- **[${c.policy_code}] ${c.category || 'İK'}:** ${body}`;
  });

  const primaryBody = String(primary.content || '').split('\n').slice(1).join(' ').trim() || primary.content;
  const sources = finalChunks.map(c => ({
    policy_code: c.policy_code,
    title: c.title,
    section: c.source_section || 'Genel',
    version: c.version || 1,
    effective_date: `${c.effective_from || ''} - ${c.effective_to || 'Süresiz'}`,
    similarity: parseFloat(c.cosine_similarity)
  }));

  return {
    answer: `**Özet Cevap:**\n${primaryBody}\n\n**Detaylar ve Koşullar:**\n${detailLines.join('\n')}\n\n**Kaynak Politikalar:**\n${finalChunks.map(c => `[${c.policy_code}] ${c.category || 'İK'} - ${c.title} (${c.source_section || 'Genel'}, Sürüm ${c.version || 1})`).join('\n')}\n\n> ℹ️ *Not: Bu yanıt sentetik demo İK veri seti üzerinden üretilmiştir.*`,
    route_used: 'LEXICAL_FALLBACK',
    sources,
    confidence: parseFloat(primary.cosine_similarity) || 0.8,
    synthetic_notice: 'Sentetik Demo Veri'
  };
}

function mergeAndDeduplicateEvidence(ragChunks, cagSnapshot, question) {
  // Filter RAG chunks by similarity threshold
  const validChunks = ragChunks.filter(c => parseFloat(c.cosine_similarity) >= SIMILARITY_THRESHOLD);

  // Deduplicate chunks by policy_code (keeping highest similarity)
  const uniqueMap = new Map();
  for (const chunk of validChunks) {
    if (!uniqueMap.has(chunk.policy_code)) {
      uniqueMap.set(chunk.policy_code, chunk);
    }
  }

  const finalChunks = Array.from(uniqueMap.values()).slice(0, 6);

  // Determine route used
  let routeUsed = 'NONE';
  if (finalChunks.length > 0 && cagSnapshot) {
    routeUsed = 'CAG_RAG';
  } else if (finalChunks.length > 0) {
    routeUsed = 'RAG';
  } else if (cagSnapshot) {
    routeUsed = 'CAG';
  }

  return {
    routeUsed,
    finalChunks,
    cagSnapshot
  };
}

const ANSWER_SYSTEM_PROMPT = `Sen Yönetim Bilgi Asistanı'nın uzman İK Politika Danışmanısın.
Görevin, yalnızca ve yalnızca sana sağlanan resmi İK politika kanıtlarını kullanarak kullanıcının sorusunu Türkçe olarak yanıtlamaktır.

TEMEL KURALLAR:
1. SADECE SAĞLANAN KANITLARI KULLAN: Kanıt metinlerinde yer almayan hiçbir bilgiyi uydurma veya varsayma.
2. ÖZEL VE KAPSAM DIŞI KONULARDA ASLA TAHMİN ETME: Eğer soru sağlanan İK kanıtlarında doğrudan ve açıkça geçmeyen bir konu (örneğin uzay üssü, roket, bitcoin/kripto para, dinozor, kurum dışı talepler vb.) içeriyorsa, ASLA genel bir İK kuralı uydurma; doğrudan "**Özet Cevap:**\\nBu konuda onaylı şirket İK politikası bulunamadı." yanıtını ver.
3. ÇELİŞKİ DURUMU: Farklı sürümler varsa her zaman en yüksek sürüm numaralı (en yeni aktif) kuralı esas al ve sürüm farkını belirt.
4. SENTETİK DEMO BİLDİRİMİ: Cevabın sonunda bu bilginin sentetik demo İK politikası olduğunu belirt.
5. FORMAT: Doğrudan Markdown cevabını yaz. Düşünme veya <think> etiketi üretme.

STANDART ÇIKTI YAPISI:
- **Özet Cevap:** (1-2 cümlelik doğrudan ve net yanıt)
- **Detaylar ve Koşullar:** (Uygulama adımları, süreler, istisnalar)
- **Kaynak Politikalar:** (Örn: [HR-xxx] Kategori - Başlık (Bölüm x, Sürüm y))
- > ℹ️ *Not: Bu yanıt sentetik demo İK veri seti üzerinden üretilmiştir.*`;

async function generateAnswerWithLlm(question, evidence) {
  const { routeUsed, finalChunks, cagSnapshot } = evidence;

  // If no chunks match similarity threshold
  if (finalChunks.length === 0) {
    return {
      answer: `**Özet Cevap:**\nBu konuda onaylı şirket İK politikası bulunamadı.\n\n> ℹ️ *Not: Bu sorgu için sistemde onaylı bir İK kuralı veya politika kaydı mevcut değildir.*`,
      route_used: 'NONE',
      sources: [],
      confidence: 0.0,
      synthetic_notice: 'Sentetik Demo Veri'
    };
  }

  // Build compact evidence context from top relevant chunks
  let contextText = '=== RESMİ İK POLİTİKA KANITLARI ===\n\n';
  contextText += finalChunks.map((c, i) => `[KANIT ${i + 1}: ${c.policy_code} - ${c.title}]\nKategori: ${c.category}\nBölüm: ${c.source_section} | Sürüm: ${c.version}\nİçerik: ${c.content}`).join('\n\n---\n\n');

  const userPrompt = `AŞAĞIDAKİ RESMİ İK KANITLARINI KULLANARAK SORUYU YANITLA:\n\n${contextText}\n\nKULLANICI SORUSU: "${question}"\n\nCEVAP:`;
  const fullPrompt = `${ANSWER_SYSTEM_PROMPT}\n\n${userPrompt}`;

  const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: LLM_MODEL,
      prompt: fullPrompt,
      stream: false,
      think: false,
      options: {
        temperature: 0.1
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Ollama generate error (${response.status}): ${response.statusText}`);
  }

  const data = await response.json();
  let rawAnswer = (data.response || '').trim();
  if (rawAnswer.includes('</think>')) {
    rawAnswer = rawAnswer.split('</think>')[1].trim();
  } else {
    rawAnswer = rawAnswer.replace(/<think>/gi, '').trim();
  }

  const syntheticNote = rawAnswer.match(/>\s*ℹ️\s*\*Not: Bu yanıt sentetik demo İK veri seti üzerinden üretilmiştir\.\*/i);
  if (syntheticNote) {
    rawAnswer = rawAnswer.slice(0, syntheticNote.index + syntheticNote[0].length).trim();
  }

  if (!rawAnswer || rawAnswer.length < 15) {
    rawAnswer = `**Özet Cevap:**\nBu konuda onaylı şirket İK politikası bulunamadı.\n\n> ℹ️ *Not: Bu sorgu için sistemde onaylı bir İK kuralı veya politika kaydı mevcut değildir.*`;
  }

  // Extract sources
  const sources = finalChunks.map(c => ({
    policy_code: c.policy_code,
    title: c.title,
    section: c.source_section || 'Genel',
    version: c.version || 1,
    effective_date: `${c.effective_from || ''} - ${c.effective_to || 'Süresiz'}`,
    similarity: parseFloat(c.cosine_similarity)
  }));

  const topSimilarity = finalChunks[0]?.cosine_similarity ? parseFloat(finalChunks[0].cosine_similarity) : 0.85;

  return {
    answer: rawAnswer,
    route_used: routeUsed,
    sources,
    confidence: topSimilarity,
    synthetic_notice: 'Sentetik Demo Veri'
  };
}

async function answerHrPolicyQuestion(question, sessionId = 'hr_session') {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  let cagSnapshot = null;
  let ragChunks = [];
  let usedLexical = false;

  try {
    cagSnapshot = await getActiveCagSnapshot();
  } catch (err) {
    console.warn('CAG snapshot unavailable:', err.message);
  }

  try {
    const queryEmbedding = await getQueryEmbedding(question);
    ragChunks = await retrieveRagChunks(queryEmbedding, 12);
  } catch (err) {
    console.warn('Embedding retrieval failed, using lexical HR fallback:', err.message);
    ragChunks = await retrievePoliciesLexical(question, 6);
    usedLexical = true;
  }

  if (!ragChunks.length) {
    ragChunks = await retrievePoliciesLexical(question, 6);
    usedLexical = true;
  }

  const evidence = mergeAndDeduplicateEvidence(ragChunks, cagSnapshot, question);

  let result;
  if (evidence.finalChunks.length === 0) {
    const lexicalChunks = usedLexical ? [] : await retrievePoliciesLexical(question, 6);
    result = formatDeterministicHrAnswer(lexicalChunks.length ? lexicalChunks : evidence.finalChunks);
  } else if (usedLexical) {
    result = formatDeterministicHrAnswer(evidence.finalChunks);
  } else {
    try {
      result = await generateAnswerWithLlm(question, evidence);
    } catch (err) {
      console.warn('LLM HR answer failed, using deterministic evidence formatting:', err.message);
      result = formatDeterministicHrAnswer(evidence.finalChunks);
    }
  }

  const latencyMs = Date.now() - startTime;

  // 6. Audit Logging
  try {
    const escapedQuestion = question.replace(/'/g, "''");
    const escapedStatus = result.sources.length > 0 ? 'SUCCESS' : 'NO_EVIDENCE';
    const metadata = {
      route_used: result.route_used,
      sources_count: result.sources.length,
      top_source: result.sources[0]?.policy_code || null,
      top_similarity: result.confidence,
      synthetic_notice: result.synthetic_notice,
      lexical_fallback: usedLexical
    };
    const metadataJson = JSON.stringify(metadata).replace(/'/g, "''");

    const sql = `
      INSERT INTO audit.chat_request (
        request_id, session_id, question, intent,
        confidence, status, latency_ms, metadata, created_at
      ) VALUES (
        '${requestId}',
        '${sessionId}',
        '${escapedQuestion}',
        'HR_POLICY',
        ${result.confidence.toFixed(3)},
        '${escapedStatus}',
        ${latencyMs},
        '${metadataJson}'::jsonb,
        now()
      );
    `;
    runPsql(sql);
  } catch (err) {
    console.error('Failed to log audit in hr_hybrid_cag_rag_engine:', err.message);
  }

  return {
    request_id: requestId,
    session_id: sessionId,
    question,
    ...result,
    latency_ms: latencyMs
  };
}

module.exports = {
  answerHrPolicyQuestion,
  getQueryEmbedding,
  retrieveRagChunks,
  retrievePoliciesLexical,
  mergeAndDeduplicateEvidence,
  generateAnswerWithLlm,
  getActiveCagSnapshot,
  formatDeterministicHrAnswer
};

if (require.main === module) {
  (async () => {
    const q = process.argv[2] || 'Yıllık izin hakkım ne zaman başlar?';
    console.log(`Testing HR Hybrid QA: "${q}"`);
    const res = await answerHrPolicyQuestion(q);
    console.log('\n--- ANSWER ---');
    console.log(res.answer);
    console.log('\n--- METADATA ---');
    console.log(JSON.stringify({
      route_used: res.route_used,
      confidence: res.confidence,
      sources: res.sources,
      latency_ms: res.latency_ms
    }, null, 2));
  })();
}
