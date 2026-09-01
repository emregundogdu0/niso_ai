const { execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const EMBEDDING_MODEL = 'qwen3-embedding:0.6b';
const EXPECTED_DIMENSION = 1024;

function runPsql(sqlQuery) {
  return execSync('docker exec -i management-postgres psql -U management_admin -d management_ai -q -X', {
    input: Buffer.from(sqlQuery, 'utf8'),
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024
  });
}

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

async function getEmbedding(text) {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Ollama embed error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  if (!data.embeddings || !data.embeddings[0]) {
    throw new Error('No embedding returned from Ollama');
  }

  const embedding = data.embeddings[0];
  if (embedding.length !== EXPECTED_DIMENSION) {
    throw new Error(`Unexpected embedding dimension: got ${embedding.length}, expected ${EXPECTED_DIMENSION}`);
  }
  return embedding;
}

function formatPolicyDoc(p) {
  const paraphrases = Array.isArray(p.paraphrases)
    ? p.paraphrases.join(' | ')
    : (typeof p.paraphrases === 'string' ? p.paraphrases : '');

  const conditions = typeof p.conditions === 'object' && p.conditions !== null
    ? JSON.stringify(p.conditions)
    : String(p.conditions || '');

  const validity = `${p.effective_from || ''} - ${p.effective_to ? p.effective_to : 'Süresiz'}`;
  const source = `${p.source_title || 'Sentetik İK Politikası'} / ${p.source_section || 'Genel'} (Sahip: ${p.owner || 'İK'})`;

  return `Kategori: ${p.category}
Kanonik Soru: ${p.canonical_question}
Alternatif Sorular: ${paraphrases}
Onaylı Cevap: ${p.answer_text}
Koşullar: ${conditions}
Geçerlilik: ${validity}
Kaynak: ${source}`;
}

function estimateTokenCount(text) {
  return Math.ceil(text.split(/\s+/).filter(Boolean).length * 1.3);
}

async function indexHrPolicies() {
  console.log('=== HR POLICY EMBEDDING INDEXER ===');
  console.log(`Embedding Model: ${EMBEDDING_MODEL}`);
  console.log(`Expected Dimension: ${EXPECTED_DIMENSION}\n`);

  // 1. Fetch active approved policies from PostgreSQL
  const selectQuery = `
    SELECT 
      id, policy_code, category, canonical_question, answer_text, 
      paraphrases, conditions, effective_from, effective_to, 
      version, source_title, source_section, owner, approved, 
      sensitivity, synthetic
    FROM hr.policy_item
    WHERE approved = true 
      AND effective_from <= CURRENT_DATE 
      AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
    ORDER BY policy_code ASC
  `;

  const policies = runPsqlJson(selectQuery);
  console.log(`Fetched ${policies.length} approved & valid policy records from hr.policy_item.`);

  // 2. Fetch existing documents for hash comparison
  const existingDocs = runPsqlJson(`SELECT external_id, content_hash, (metadata->>'version')::int AS version, is_active FROM rag.document WHERE source_type = 'hr_policy'`);
  const existingDocMap = new Map();
  for (const doc of existingDocs) {
    existingDocMap.set(doc.external_id, doc);
  }

  let insertedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  const errors = [];

  for (let i = 0; i < policies.length; i++) {
    const policy = policies[i];
    try {
      const content = formatPolicyDoc(policy);
      const contentHash = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
      const tokenCount = estimateTokenCount(content);

      const metadata = {
        policy_code: policy.policy_code,
        category: policy.category,
        version: policy.version,
        effective_from: policy.effective_from,
        effective_to: policy.effective_to,
        approved: policy.approved,
        synthetic: policy.synthetic,
        sensitivity: policy.sensitivity,
        owner: policy.owner,
        source_section: policy.source_section
      };

      const existing = existingDocMap.get(policy.policy_code);

      // Idempotency check: if content_hash matches and document is active, skip re-embedding
      if (existing && existing.content_hash === contentHash && existing.is_active) {
        skippedCount++;
        continue;
      }

      // Generate embedding from Ollama
      process.stdout.write(`Embedding [${i + 1}/${policies.length}] ${policy.policy_code}... `);
      const embeddingVector = await getEmbedding(content);
      const vectorLiteral = `[${embeddingVector.join(',')}]`;

      const escapedContent = content.replace(/'/g, "''");
      const escapedTitle = `${policy.category} - ${policy.canonical_question}`.replace(/'/g, "''");
      const metadataJson = JSON.stringify(metadata).replace(/'/g, "''");

      // Transactional Upsert
      const upsertSql = `
        DO $$
        DECLARE
          v_doc_id UUID;
        BEGIN
          -- Upsert document
          INSERT INTO rag.document (
            source_type, external_id, title, project_code,
            content_hash, source_uri, sensitivity, is_active, metadata
          )
          VALUES (
            'hr_policy',
            '${policy.policy_code}',
            '${escapedTitle}',
            'HR_POLICY',
            '${contentHash}',
            'hr.policy_item/${policy.policy_code}',
            '${policy.sensitivity || 'internal_demo'}',
            true,
            '${metadataJson}'::jsonb
          )
          ON CONFLICT (source_type, external_id) DO UPDATE SET
            title = EXCLUDED.title,
            content_hash = EXCLUDED.content_hash,
            sensitivity = EXCLUDED.sensitivity,
            is_active = true,
            metadata = EXCLUDED.metadata,
            created_at = now()
          RETURNING id INTO v_doc_id;

          -- Clean existing chunks for this document if updating
          DELETE FROM rag.chunk WHERE document_id = v_doc_id;

          -- Insert chunk
          INSERT INTO rag.chunk (
            document_id, chunk_index, content, token_count,
            embedding_model, embedding_dimension, embedding, metadata
          )
          VALUES (
            v_doc_id,
            0,
            '${escapedContent}',
            ${tokenCount},
            '${EMBEDDING_MODEL}',
            ${EXPECTED_DIMENSION},
            '${vectorLiteral}'::vector,
            '${metadataJson}'::jsonb
          );
        END $$;
      `;

      runPsql(upsertSql);
      if (existing) {
        updatedCount++;
        console.log('UPDATED');
      } else {
        insertedCount++;
        console.log('INSERTED');
      }
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
      errors.push({
        policy_code: policy.policy_code,
        error: err.message
      });
    }
  }

  // Verification Counts
  const docCountResult = runPsqlJson(`SELECT COUNT(*)::int AS count FROM rag.document WHERE source_type = 'hr_policy' AND is_active = true`);
  const chunkCountResult = runPsqlJson(`SELECT COUNT(*)::int AS count FROM rag.chunk WHERE embedding_model = '${EMBEDDING_MODEL}'`);

  const summary = {
    embedding_model: EMBEDDING_MODEL,
    embedding_dimension: EXPECTED_DIMENSION,
    total_policies_fetched: policies.length,
    inserted_documents: insertedCount,
    updated_documents: updatedCount,
    skipped_documents: skippedCount,
    active_documents_in_db: docCountResult[0]?.count || 0,
    active_chunks_in_db: chunkCountResult[0]?.count || 0,
    error_count: errors.length,
    errors
  };

  console.log('\n=== INDEXING SUMMARY ===');
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

async function semanticSearch(query, topK = 5) {
  const queryEmbedding = await getEmbedding(query);
  const vectorLiteral = `[${queryEmbedding.join(',')}]`;

  const searchSql = `
    SELECT 
      c.id AS chunk_id,
      d.external_id AS policy_code,
      d.title,
      c.metadata->>'category' AS category,
      c.metadata->>'version' AS version,
      ROUND((1 - (c.embedding <=> '${vectorLiteral}'::vector))::numeric, 4) AS cosine_similarity,
      ROUND((c.embedding <=> '${vectorLiteral}'::vector)::numeric, 4) AS cosine_distance,
      SUBSTRING(c.content, 1, 150) AS snippet
    FROM rag.chunk c
    JOIN rag.document d ON c.document_id = d.id
    WHERE d.is_active = true
    ORDER BY c.embedding <=> '${vectorLiteral}'::vector ASC
    LIMIT ${topK}
  `;

  return runPsqlJson(searchSql);
}

module.exports = {
  indexHrPolicies,
  semanticSearch,
  getEmbedding,
  formatPolicyDoc
};

if (require.main === module) {
  (async () => {
    try {
      await indexHrPolicies();
    } catch (err) {
      console.error('Fatal error during indexing:', err);
      process.exit(1);
    }
  })();
}
