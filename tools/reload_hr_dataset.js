const fs = require('fs');
const { execSync } = require('child_process');

const lines = fs.readFileSync('hr_policy_dataset_100.jsonl', 'utf8')
  .trim()
  .split('\n')
  .filter(Boolean)
  .map(l => JSON.parse(l));

console.log(`Loaded ${lines.length} lines from hr_policy_dataset_100.jsonl`);

const queries = lines.map(r => {
  const cat = r.category.replace(/'/g, "''");
  const cq = r.canonical_question.replace(/'/g, "''");
  const ans = r.answer_text.replace(/'/g, "''");
  const para = JSON.stringify(r.paraphrases).replace(/'/g, "''");
  const cond = JSON.stringify(r.conditions).replace(/'/g, "''");
  const st = r.source_title.replace(/'/g, "''");
  const ss = r.source_section.replace(/'/g, "''");
  const own = r.owner.replace(/'/g, "''");

  return `
    INSERT INTO hr.policy_item (
      policy_code, category, canonical_question, answer_text,
      paraphrases, conditions, effective_from, effective_to,
      version, source_title, source_section, owner,
      approved, sensitivity, synthetic
    ) VALUES (
      '${r.policy_code}', '${cat}', '${cq}', '${ans}',
      '${para}'::jsonb, '${cond}'::jsonb, '${r.effective_from}', NULL,
      ${r.version}, '${st}', '${ss}', '${own}',
      true, '${r.sensitivity}', true
    )
    ON CONFLICT (policy_code) DO UPDATE SET
      category = EXCLUDED.category,
      canonical_question = EXCLUDED.canonical_question,
      answer_text = EXCLUDED.answer_text,
      paraphrases = EXCLUDED.paraphrases,
      conditions = EXCLUDED.conditions,
      version = EXCLUDED.version,
      source_title = EXCLUDED.source_title,
      source_section = EXCLUDED.source_section,
      owner = EXCLUDED.owner,
      approved = EXCLUDED.approved,
      sensitivity = EXCLUDED.sensitivity,
      synthetic = EXCLUDED.synthetic,
      updated_at = now();
  `;
}).join('\n');

execSync('docker exec -i management-postgres psql -U management_admin -d management_ai -q', {
  input: Buffer.from(`BEGIN;\n${queries}\nCOMMIT;`, 'utf8'),
  encoding: 'utf8',
  maxBuffer: 50 * 1024 * 1024
});

console.log('Successfully reloaded hr.policy_item database records.');
