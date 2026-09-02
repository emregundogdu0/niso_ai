const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ID = 'DGu4CJhdcNhB2Rjx';

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

async function main() {
  console.log('1. Preparing clean workflow files in container...');
  execSync('docker exec n8n rm -rf /tmp/clean_workflows && docker exec n8n mkdir -p /tmp/clean_workflows');

  for (const file of workflowFiles) {
    const localPath = path.join(__dirname, '..', file);
    if (fs.existsSync(localPath)) {
      let content = JSON.parse(fs.readFileSync(localPath, 'utf8'));
      if (Array.isArray(content)) content = content[0];
      const containerPath = `/tmp/clean_workflows/${file}`;
      execSync(`docker exec -i n8n sh -c "cat > ${containerPath}"`, {
        input: Buffer.from(JSON.stringify(content, null, 2), 'utf8')
      });
      console.log(` - Staged ${file}`);
    }
  }

  console.log('\n2. Clearing old workflows in SQLite (preserving My workflow)...');
  const cleanScript = `
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('/home/node/.n8n/database.sqlite');
const keepId = 't9G51KMrY25zFABs';
db.prepare('DELETE FROM shared_workflow WHERE workflowId != ?').run(keepId);
db.prepare('DELETE FROM workflow_history WHERE workflowId != ?').run(keepId);
db.prepare('DELETE FROM workflow_entity WHERE id != ?').run(keepId);
console.log('Cleared old workflow records.');
`;
  execSync('docker exec -i n8n node --experimental-sqlite -e "' + cleanScript.replace(/"/g, '\\"').replace(/\n/g, ' ') + '"');

  console.log('\n3. Importing all 16 clean workflows into n8n...');
  const res = execSync(`docker exec n8n n8n import:workflow --separate --input=/tmp/clean_workflows/ --projectId=${PROJECT_ID}`, {
    encoding: 'utf8'
  });
  console.log(res);

  console.log('\n4. Resolving new workflow IDs and linking Execute Workflow nodes...');
  const listScript = `
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('/home/node/.n8n/database.sqlite');
const rows = db.prepare('SELECT id, name FROM workflow_entity ORDER BY name ASC;').all();
console.log(JSON.stringify(rows));
`;
  const listRes = execSync('docker exec -i n8n node --experimental-sqlite -e "' + listScript.replace(/"/g, '\\"').replace(/\n/g, ' ') + '"', { encoding: 'utf8' });
  const allWorkflows = JSON.parse(listRes.trim());

  const wfMap = new Map();
  allWorkflows.forEach(w => wfMap.set(w.name, w.id));

  console.log('Workflow Mapping:');
  allWorkflows.forEach(w => console.log(` - [${w.id}] ${w.name}`));

  // Linkages
  const routerId = wfMap.get('06_Chat_Intent_Router');
  const hrId = wfMap.get('07_HR_Hybrid_CAG_RAG_Answer');
  const sqlId = wfMap.get('09_Secure_Text_to_SQL');
  const mailId = wfMap.get('11_Project_Mail_RAG_Answer');
  const hybridId = wfMap.get('11_Hybrid_Evidence_Merger');
  const commonIngestionId = wfMap.get('10C_Common_Mail_Ingestion');
  const gmailId = wfMap.get('10A_Gmail_Mail_Source');
  const outlookId = wfMap.get('10B_Outlook_Mail_Source');

  const linkScript = `
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('/home/node/.n8n/database.sqlite');

// 1. Update Router
const router = db.prepare('SELECT nodes FROM workflow_entity WHERE id = ?').get(${JSON.stringify(routerId)});
if (router) {
  const nodes = JSON.parse(router.nodes);
  nodes.forEach(n => {
    if (n.name === 'Execute Sub-Workflow HR Hybrid' && n.parameters?.workflowId) n.parameters.workflowId.value = ${JSON.stringify(hrId)};
    if (n.name === 'Execute Sub-Workflow Attendance SQL' && n.parameters?.workflowId) n.parameters.workflowId.value = ${JSON.stringify(sqlId)};
    if (n.name === 'Execute Sub-Workflow Project Mail RAG' && n.parameters?.workflowId) n.parameters.workflowId.value = ${JSON.stringify(mailId)};
    if (n.name === 'Execute Sub-Workflow Hybrid Evidence Merger' && n.parameters?.workflowId) n.parameters.workflowId.value = ${JSON.stringify(hybridId)};
  });
  db.prepare('UPDATE workflow_entity SET nodes = ? WHERE id = ?').run(JSON.stringify(nodes), ${JSON.stringify(routerId)});
}

// 2. Update Gmail Source
const gmail = db.prepare('SELECT nodes FROM workflow_entity WHERE id = ?').get(${JSON.stringify(gmailId)});
if (gmail) {
  const nodes = JSON.parse(gmail.nodes);
  nodes.forEach(n => {
    if (n.name === "Call '10C_Common_Mail_Ingestion'" && n.parameters?.workflowId) n.parameters.workflowId.value = ${JSON.stringify(commonIngestionId)};
  });
  db.prepare('UPDATE workflow_entity SET nodes = ? WHERE id = ?').run(JSON.stringify(nodes), ${JSON.stringify(gmailId)});
}

// 3. Update Outlook Source
const outlook = db.prepare('SELECT nodes FROM workflow_entity WHERE id = ?').get(${JSON.stringify(outlookId)});
if (outlook) {
  const nodes = JSON.parse(outlook.nodes);
  nodes.forEach(n => {
    if (n.name === "Send to 10C Common Ingestion Pipeline" && n.parameters?.workflowId) n.parameters.workflowId.value = ${JSON.stringify(commonIngestionId)};
  });
  db.prepare('UPDATE workflow_entity SET nodes = ? WHERE id = ?').run(JSON.stringify(nodes), ${JSON.stringify(outlookId)});
}
console.log('Sub-workflow links successfully established in SQLite.');
`;
  execSync('docker exec -i n8n node --experimental-sqlite -e "' + linkScript.replace(/"/g, '\\"').replace(/\n/g, ' ') + '"');

  console.log('\nAll workflows cleanly imported and linked! ✅');
}

main().catch(console.error);
