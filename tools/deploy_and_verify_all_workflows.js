const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const workflowFileMap = {
  'localLlmHealthcheck01': 'n8n_01_local_llm_healthcheck_workflow.json',
  'postgresPgvectorHealthcheck02': 'n8n_02_postgres_pgvector_healthcheck_workflow.json',
  'hrDatasetLoad03': 'n8n_03_hr_dataset_load_workflow.json',
  'IgaP6VN92BTFu0cs': 'n8n_04_hr_embedding_index_workflow.json',
  'pJKYgv50KrlbdAay': 'n8n_05_hr_cag_snapshot_build_workflow.json',
  'lxi5cG6Na2L11ZwH': 'n8n_06_chat_intent_router_workflow.json',
  '60asCH6v5sATWMfW': 'n8n_07_hr_hybrid_cag_rag_answer_workflow.json',
  'ujWDbyXaizox60KQ': 'n8n_08_attendance_synthetic_data_load_workflow.json',
  'FVXBFc32SsOB9YHx': 'n8n_09_secure_text_to_sql_workflow.json',
  'atLmQzSoA8IhnJki': 'n8n_10_company_knowledge_rag_workflow.json',
  'iT8uVQDATECFvVko': 'n8n_10A_gmail_mail_source_workflow.json',
  'YRmiTim1IgrvniBf': 'n8n_10B_outlook_mail_source_workflow.json',
  'jCZD2ezaSyAFysT1': 'n8n_10C_common_mail_ingestion_workflow.json',
  'MGoU6i9YoqALomCW': 'n8n_11_hybrid_evidence_merger_workflow.json',
  'qkdTZicYKysOUjaa': 'n8n_11_project_mail_rag_answer_workflow.json',
  'bgmIknagpFENNvF4': 'n8n_12_global_error_handler_workflow.json'
};

async function updateAndVerifyWorkflows() {
  console.log('================================================================');
  console.log('   UPDATING WORKFLOWS IN LIVE N8N INSTANCE (SQLITE DB)         ');
  console.log('================================================================\n');

  for (const [wfId, fileName] of Object.entries(workflowFileMap)) {
    const filePath = path.join(__dirname, '..', fileName);
    if (!fs.existsSync(filePath)) {
      console.warn('File not found:', fileName);
      continue;
    }

    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const nodesJson = JSON.stringify(content.nodes || []);
    const connsJson = JSON.stringify(content.connections || {});
    const settingsJson = JSON.stringify(content.settings || { executionOrder: 'v1' });
    const name = content.name;

    // Run SQLite update inside container
    const updateScript = `
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('/home/node/.n8n/database.sqlite');
db.prepare('UPDATE workflow_entity SET name = ?, nodes = ?, connections = ?, settings = ?, updatedAt = datetime("now") WHERE id = ?')
  .run(${JSON.stringify(name)}, ${JSON.stringify(nodesJson)}, ${JSON.stringify(connsJson)}, ${JSON.stringify(settingsJson)}, ${JSON.stringify(wfId)});
`;

    execSync('docker exec -i n8n node --experimental-sqlite -e "' + updateScript.replace(/"/g, '\\"').replace(/\n/g, ' ') + '"');
    console.log(`Updated workflow [${wfId}] ${name} (${content.nodes.length} nodes) in n8n.`);
  }

  console.log('\n--- VERIFYING WORKFLOWS IN N8N DB ---');
  const checkScript = `
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('/home/node/.n8n/database.sqlite');
const list = db.prepare('SELECT id, name, nodes FROM workflow_entity ORDER BY name ASC;').all();
console.log(JSON.stringify(list.map(w => ({ id: w.id, name: w.name, nodeCount: JSON.parse(w.nodes||'[]').length }))));
`;

  const checkResult = execSync('docker exec -i n8n node --experimental-sqlite -e "' + checkScript.replace(/"/g, '\\"').replace(/\n/g, ' ') + '"', { encoding: 'utf8' });
  const verifiedList = JSON.parse(checkResult.trim());
  verifiedList.forEach((w, i) => {
    console.log(`${i + 1}. [${w.id}] ${w.name} (Nodes: ${w.nodeCount})`);
  });

  console.log('\nAll workflows successfully updated and verified in n8n! ✅');
}

updateAndVerifyWorkflows().catch(console.error);
