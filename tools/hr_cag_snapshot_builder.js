const { execSync } = require('child_process');
const crypto = require('crypto');

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

function formatSinglePolicy(p) {
  const cond = typeof p.conditions === 'object' && p.conditions !== null
    ? JSON.stringify(p.conditions)
    : String(p.conditions || '');

  const validity = `${p.effective_from || ''} - ${p.effective_to ? p.effective_to : 'Süresiz'}`;
  const source = `${p.source_title || 'Sentetik İK Politikası'} / ${p.source_section || 'Genel'} (Sahip: ${p.owner || 'İK'})`;

  return `[POLITIKA_KODU: ${p.policy_code}]
Kategori: ${p.category}
Kanonik Soru: ${p.canonical_question}
Onaylı Cevap: ${p.answer_text}
Koşullar: ${cond}
Geçerlilik: ${validity}
Kaynak: ${source}`;
}

function estimateTokens(text) {
  return Math.ceil(text.split(/\s+/).filter(Boolean).length * 1.3);
}

async function buildCagSnapshot() {
  console.log('=== HR CAG POLICY SNAPSHOT BUILDER ===');

  // 1. Fetch active approved policies deterministically sorted by policy_code
  const selectQuery = `
    SELECT 
      policy_code, category, canonical_question, answer_text, 
      conditions, effective_from, effective_to, version, 
      source_title, source_section, owner, approved, sensitivity, synthetic
    FROM hr.policy_item
    WHERE approved = true 
      AND effective_from <= CURRENT_DATE 
      AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
    ORDER BY policy_code ASC
  `;

  const policies = runPsqlJson(selectQuery);
  console.log(`Fetched ${policies.length} active approved policies from hr.policy_item.`);

  if (policies.length === 0) {
    throw new Error('No active approved policies found to build snapshot.');
  }

  // 2. Format compact context blocks
  const formattedBlocks = policies.map(formatSinglePolicy);
  const fullContent = formattedBlocks.join('\n\n---\n\n');
  const contentHash = crypto.createHash('sha256').update(fullContent, 'utf8').digest('hex');
  const tokenEstimate = estimateTokens(fullContent);

  const sourceVersions = {};
  for (const p of policies) {
    sourceVersions[p.policy_code] = {
      version: p.version,
      category: p.category
    };
  }

  console.log(`Snapshot size: ${fullContent.length} chars, ~${tokenEstimate} tokens, hash: ${contentHash.substring(0, 16)}...`);

  // 3. Fetch active snapshot in DB
  const activeSnapshots = runPsqlJson(`SELECT id, snapshot_version, content_hash, policy_count, token_estimate, is_active FROM hr.policy_snapshot WHERE is_active = true`);
  const currentActive = activeSnapshots.length > 0 ? activeSnapshots[0] : null;

  // 4. Compare hash for change detection / idempotency
  if (currentActive && currentActive.content_hash === contentHash) {
    console.log(`Active snapshot version ${currentActive.snapshot_version} is already up to date with identical hash. SKIPPING new version creation.`);
    return {
      status: 'SUCCESS',
      action: 'SKIPPED',
      message: 'No changes detected; active snapshot maintained.',
      snapshot_version: currentActive.snapshot_version,
      content_hash: currentActive.content_hash,
      policy_count: currentActive.policy_count,
      token_estimate: currentActive.token_estimate,
      is_active: true
    };
  }

  // 5. Determine next version number
  const versionQuery = runPsqlJson(`SELECT COALESCE(MAX(snapshot_version), 0)::int AS max_version FROM hr.policy_snapshot`);
  const nextVersion = (versionQuery[0]?.max_version || 0) + 1;

  console.log(`Creating new CAG snapshot version ${nextVersion}...`);

  // 6. Transactional Invalidation and Creation
  const escapedContent = fullContent.replace(/'/g, "''");
  const sourceVersionsJson = JSON.stringify(sourceVersions).replace(/'/g, "''");

  const transactionSql = `
    BEGIN;
    
    -- Invalidate previous active snapshot
    UPDATE hr.policy_snapshot
    SET is_active = false, invalidated_at = now()
    WHERE is_active = true;

    -- Insert new active snapshot
    INSERT INTO hr.policy_snapshot (
      snapshot_version, content, content_hash, policy_count,
      token_estimate, source_versions, valid_from, is_active
    ) VALUES (
      ${nextVersion},
      '${escapedContent}',
      '${contentHash}',
      ${policies.length},
      ${tokenEstimate},
      '${sourceVersionsJson}'::jsonb,
      now(),
      true
    );

    COMMIT;
  `;

  runPsql(transactionSql);

  const summary = {
    status: 'SUCCESS',
    action: 'CREATED',
    snapshot_version: nextVersion,
    content_hash: contentHash,
    policy_count: policies.length,
    token_estimate: tokenEstimate,
    invalidated_previous_version: currentActive ? currentActive.snapshot_version : null,
    is_active: true
  };

  console.log('Snapshot successfully created & verified:');
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

function getActiveSnapshot() {
  const rows = runPsqlJson(`SELECT id, snapshot_version, content, content_hash, policy_count, token_estimate, source_versions, valid_from, invalidated_at, is_active, created_at FROM hr.policy_snapshot WHERE is_active = true`);
  return rows.length > 0 ? rows[0] : null;
}

module.exports = {
  buildCagSnapshot,
  getActiveSnapshot,
  formatSinglePolicy,
  estimateTokens
};

if (require.main === module) {
  (async () => {
    try {
      await buildCagSnapshot();
    } catch (err) {
      console.error('Fatal error building CAG snapshot:', err);
      process.exit(1);
    }
  })();
}
