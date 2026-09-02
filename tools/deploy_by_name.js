const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const workflowFiles = [
  'n8n_01_local_llm_healthcheck_workflow.json',
  'n8n_02_postgres_pgvector_healthcheck_workflow.json',
  'n8n_03_hr_dataset_load_workflow.json',
  'n8n_04_hr_embedding_index_workflow.json',
  'n8n_05_hr_cag_snapshot_build_workflow.json',
  'n8n_06_chat_intent_router_workflow.json',
  'n8n_07_hr_hybrid_cag_rag_answer_workflow.json',
  'n8n_08_attendance_synthetic_data_load_workflow.json',
  'n8n_09_secure_text_to_sql_workflow.json',
  'n8n_10A_gmail_mail_source_workflow.json',
  'n8n_10B_outlook_mail_source_workflow.json',
  'n8n_10C_common_mail_ingestion_workflow.json',
  'n8n_10_company_knowledge_rag_workflow.json',
  'n8n_11_project_mail_rag_answer_workflow.json',
  'n8n_11_hybrid_evidence_merger_workflow.json',
  'n8n_12_global_error_handler_workflow.json'
];

async function deployByName() {
  console.log('Deploying clean workflow definitions by name into n8n SQLite...');

  const updates = [];
  for (const file of workflowFiles) {
    const p = path.join(__dirname, '..', file);
    if (!fs.existsSync(p)) continue;
    let content = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (Array.isArray(content)) content = content[0];

    updates.push({
      name: content.name,
      nodes: JSON.stringify(content.nodes || []),
      connections: JSON.stringify(content.connections || {}),
      settings: JSON.stringify(content.settings || { executionOrder: 'v1' })
    });
  }

  execSync('docker exec -i n8n sh -c "cat > /tmp/workflow_updates_by_name.json"', {
    input: Buffer.from(JSON.stringify(updates), 'utf8')
  });

  const runScript = `
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('/home/node/.n8n/database.sqlite');

const updates = JSON.parse(fs.readFileSync('/tmp/workflow_updates_by_name.json', 'utf8'));
const stmt = db.prepare('UPDATE workflow_entity SET nodes = ?, connections = ?, settings = ?, updatedAt = CURRENT_TIMESTAMP WHERE name = ?');

for (const u of updates) {
  const res = stmt.run(u.nodes, u.connections, u.settings, u.name);
  console.log('Updated workflow: ' + u.name + ' (changes: ' + res.changes + ')');
}
`;

  const result = execSync('docker exec -i n8n node --experimental-sqlite -e "' + runScript.replace(/"/g, '\\"').replace(/\n/g, ' ') + '"', { encoding: 'utf8' });
  console.log(result);
}

deployByName().catch(console.error);
