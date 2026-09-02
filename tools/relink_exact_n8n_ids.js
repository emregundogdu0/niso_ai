const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const script = `
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('/home/node/.n8n/database.sqlite');

const routerId = 'm3C576WsNJ765h0S';
const hrId = 'X48s6TzlpKpVNu2w';
const sqlId = 'DowKEdcS2nQbR1wc';
const mailId = 'aopNq0brScuCKrU7';
const hybridId = 'uSevqGz9uojM7OM7';
const commonIngestionId = 'a4o1zq8xsRaRQv7b';
const gmailId = 'HZZQ0Ck54VYbfWx6';
const outlookId = 'Tol7bGYEacspOQzs';

// 1. Update Router
const router = db.prepare('SELECT nodes FROM workflow_entity WHERE id = ?').get(routerId);
if (router) {
  const nodes = JSON.parse(router.nodes);
  nodes.forEach(n => {
    if (n.name === 'Execute Sub-Workflow HR Hybrid' && n.parameters?.workflowId) {
      n.parameters.workflowId.value = hrId;
      n.parameters.workflowId.cachedResultUrl = '/workflow/' + hrId;
    }
    if (n.name === 'Execute Sub-Workflow Attendance SQL' && n.parameters?.workflowId) {
      n.parameters.workflowId.value = sqlId;
      n.parameters.workflowId.cachedResultUrl = '/workflow/' + sqlId;
    }
    if (n.name === 'Execute Sub-Workflow Project Mail RAG' && n.parameters?.workflowId) {
      n.parameters.workflowId.value = mailId;
      n.parameters.workflowId.cachedResultUrl = '/workflow/' + mailId;
    }
    if (n.name === 'Execute Sub-Workflow Hybrid Evidence Merger' && n.parameters?.workflowId) {
      n.parameters.workflowId.value = hybridId;
      n.parameters.workflowId.cachedResultUrl = '/workflow/' + hybridId;
    }
  });
  db.prepare('UPDATE workflow_entity SET nodes = ? WHERE id = ?').run(JSON.stringify(nodes), routerId);
  console.log('Router sub-workflow links updated to live IDs.');
}

// 2. Update Gmail Source
const gmail = db.prepare('SELECT nodes FROM workflow_entity WHERE id = ?').get(gmailId);
if (gmail) {
  const nodes = JSON.parse(gmail.nodes);
  nodes.forEach(n => {
    if (n.name === "Call '10C_Common_Mail_Ingestion'" && n.parameters?.workflowId) {
      n.parameters.workflowId.value = commonIngestionId;
      n.parameters.workflowId.cachedResultUrl = '/workflow/' + commonIngestionId;
    }
  });
  db.prepare('UPDATE workflow_entity SET nodes = ? WHERE id = ?').run(JSON.stringify(nodes), gmailId);
  console.log('Gmail sub-workflow link updated to live ID.');
}

// 3. Update Outlook Source
const outlook = db.prepare('SELECT nodes FROM workflow_entity WHERE id = ?').get(outlookId);
if (outlook) {
  const nodes = JSON.parse(outlook.nodes);
  nodes.forEach(n => {
    if (n.name === "Send to 10C Common Ingestion Pipeline" && n.parameters?.workflowId) {
      n.parameters.workflowId.value = commonIngestionId;
      n.parameters.workflowId.cachedResultUrl = '/workflow/' + commonIngestionId;
    }
  });
  db.prepare('UPDATE workflow_entity SET nodes = ? WHERE id = ?').run(JSON.stringify(nodes), outlookId);
  console.log('Outlook sub-workflow link updated to live ID.');
}
`;

const res = execSync('docker exec -i n8n node --experimental-sqlite -e "' + script.replace(/"/g, '\\"').replace(/\n/g, ' ') + '"', { encoding: 'utf8' });
console.log(res);

// Also sync to local JSON files
const exportRes = execSync('docker exec n8n n8n export:workflow --all', { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
const exportedWfs = JSON.parse(exportRes);

const fileMap = {
  '01_Local_LLM_Healthcheck': 'n8n_01_local_llm_healthcheck_workflow.json',
  '02_Postgres_PGVector_Healthcheck': 'n8n_02_postgres_pgvector_healthcheck_workflow.json',
  '03_HR_Dataset_Load': 'n8n_03_hr_dataset_load_workflow.json',
  '04_HR_Embedding_Index': 'n8n_04_hr_embedding_index_workflow.json',
  '05_HR_CAG_Snapshot_Build': 'n8n_05_hr_cag_snapshot_build_workflow.json',
  '06_Chat_Intent_Router': 'n8n_06_chat_intent_router_workflow.json',
  '07_HR_Hybrid_CAG_RAG_Answer': 'n8n_07_hr_hybrid_cag_rag_answer_workflow.json',
  '08_Attendance_Synthetic_Data_Load': 'n8n_08_attendance_synthetic_data_load_workflow.json',
  '09_Secure_Text_to_SQL': 'n8n_09_secure_text_to_sql_workflow.json',
  '10A_Gmail_Mail_Source': 'n8n_10A_gmail_mail_source_workflow.json',
  '10B_Outlook_Mail_Source': 'n8n_10B_outlook_mail_source_workflow.json',
  '10C_Common_Mail_Ingestion': 'n8n_10C_common_mail_ingestion_workflow.json',
  '10_Company_Knowledge_RAG_Answer': 'n8n_10_company_knowledge_rag_workflow.json',
  '11_Hybrid_Evidence_Merger': 'n8n_11_hybrid_evidence_merger_workflow.json',
  '11_Project_Mail_RAG_Answer': 'n8n_11_project_mail_rag_answer_workflow.json',
  '12_Global_Error_Handler': 'n8n_12_global_error_handler_workflow.json'
};

exportedWfs.forEach(w => {
  if (fileMap[w.name]) {
    const p = path.join(__dirname, '..', fileMap[w.name]);
    fs.writeFileSync(p, JSON.stringify(w, null, 2), 'utf8');
    console.log(`Synchronized ${fileMap[w.name]} with live n8n exported state.`);
  }
});
