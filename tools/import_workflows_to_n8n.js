const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ID = 'DGu4CJhdcNhB2Rjx';

const workflowFiles = [
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

async function importAllWorkflows() {
  console.log('================================================================');
  console.log('          IMPORTING WORKFLOWS INTO N8N INSTANCE                 ');
  console.log('================================================================\n');

  // Step 1: Create tmp directory inside n8n container
  execSync('docker exec n8n rm -rf /tmp/workflows && docker exec n8n mkdir -p /tmp/workflows');

  // Step 2: Copy JSON files into n8n container
  for (const file of workflowFiles) {
    const localPath = path.join(__dirname, '..', file);
    if (fs.existsSync(localPath)) {
      const content = fs.readFileSync(localPath, 'utf8');
      const containerPath = `/tmp/workflows/${file}`;
      execSync(`docker exec -i n8n sh -c "cat > ${containerPath}"`, {
        input: Buffer.from(content, 'utf8')
      });
      console.log(`Copied ${file} to n8n container /tmp/workflows/`);
    }
  }

  // Step 3: Run n8n import:workflow command
  console.log('\nRunning n8n import:workflow...');
  const importResult = execSync(`docker exec n8n n8n import:workflow --separate --input=/tmp/workflows/ --projectId=${PROJECT_ID}`, {
    encoding: 'utf8'
  });
  console.log(importResult);

  // Step 4: Export and list all workflows currently in n8n
  console.log('\n--- Current Workflows in n8n after import ---');
  const exportOutput = execSync('docker exec n8n n8n export:workflow --all', {
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024
  });

  const allWorkflows = JSON.parse(exportOutput);
  console.log(`Total Workflows in n8n: ${allWorkflows.length}\n`);

  const workflowMap = new Map();
  allWorkflows.forEach((w, idx) => {
    workflowMap.set(w.name, w.id);
    console.log(`${idx + 1}. [${w.id}] ${w.name} (Active: ${w.active})`);
  });

  console.log('\n================================================================');
  console.log('       RE-LINKING EXECUTE WORKFLOW NODE IDS IN N8N              ');
  console.log('================================================================\n');

  // Update Execute Workflow IDs in Router (06)
  const hrId = workflowMap.get('07_HR_Hybrid_CAG_RAG_Answer');
  const sqlId = workflowMap.get('09_Secure_Text_to_SQL');
  const mailId = workflowMap.get('11_Project_Mail_RAG_Answer');
  const hybridId = workflowMap.get('11_Hybrid_Evidence_Merger');

  console.log('Resolved Sub-Workflow IDs:');
  console.log(' - HR Hybrid ID    :', hrId);
  console.log(' - Attendance SQL ID:', sqlId);
  console.log(' - Project Mail ID  :', mailId);
  console.log(' - Hybrid Merger ID :', hybridId);

  const routerFile = path.join(__dirname, '..', 'n8n_06_chat_intent_router_workflow.json');
  if (fs.existsSync(routerFile)) {
    let routerJson = JSON.parse(fs.readFileSync(routerFile, 'utf8'));
    const wf = Array.isArray(routerJson) ? routerJson[0] : routerJson;

    wf.nodes.forEach(node => {
      if (node.name === 'Execute Sub-Workflow HR Hybrid' && node.parameters?.workflowId && hrId) {
        node.parameters.workflowId.value = hrId;
        console.log(`Linked HR Hybrid in Router -> n8n ID: ${hrId}`);
      }
      if (node.name === 'Execute Sub-Workflow Attendance SQL' && node.parameters?.workflowId && sqlId) {
        node.parameters.workflowId.value = sqlId;
        console.log(`Linked Attendance SQL in Router -> n8n ID: ${sqlId}`);
      }
      if (node.name === 'Execute Sub-Workflow Project Mail RAG' && node.parameters?.workflowId && mailId) {
        node.parameters.workflowId.value = mailId;
        console.log(`Linked Project Mail RAG in Router -> n8n ID: ${mailId}`);
      }
      if (node.name === 'Execute Sub-Workflow Hybrid Evidence Merger' && node.parameters?.workflowId && hybridId) {
        node.parameters.workflowId.value = hybridId;
        console.log(`Linked Hybrid Merger in Router -> n8n ID: ${hybridId}`);
      }
    });

    fs.writeFileSync(routerFile, JSON.stringify(wf, null, 2), 'utf8');

    // Update in n8n container
    execSync(`docker exec -i n8n sh -c "cat > /tmp/workflows/n8n_06_chat_intent_router_workflow.json"`, {
      input: Buffer.from(JSON.stringify(wf, null, 2), 'utf8')
    });
    execSync(`docker exec n8n n8n import:workflow --input=/tmp/workflows/n8n_06_chat_intent_router_workflow.json --projectId=${PROJECT_ID}`);
    console.log('Updated 06_Chat_Intent_Router imported cleanly.');
  }

  // Update Gmail Source (10A) and Outlook Source (10B) to link to 10C_Common_Mail_Ingestion
  const commonIngestionId = workflowMap.get('10C_Common_Mail_Ingestion');
  if (commonIngestionId) {
    const gmailFile = path.join(__dirname, '..', 'n8n_10A_gmail_mail_source_workflow.json');
    if (fs.existsSync(gmailFile)) {
      const gWf = JSON.parse(fs.readFileSync(gmailFile, 'utf8'));
      gWf.nodes.forEach(node => {
        if (node.name === 'Trigger Common Ingestion Pipeline' && node.parameters?.workflowId) {
          node.parameters.workflowId.value = commonIngestionId;
        }
      });
      fs.writeFileSync(gmailFile, JSON.stringify(gWf, null, 2), 'utf8');
      execSync(`docker exec -i n8n sh -c "cat > /tmp/workflows/n8n_10A_gmail_mail_source_workflow.json"`, {
        input: Buffer.from(JSON.stringify(gWf, null, 2), 'utf8')
      });
      execSync(`docker exec n8n n8n import:workflow --input=/tmp/workflows/n8n_10A_gmail_mail_source_workflow.json --projectId=${PROJECT_ID}`);
      console.log(`Linked 10A Gmail -> 10C Common Ingestion (ID: ${commonIngestionId})`);
    }

    const outlookFile = path.join(__dirname, '..', 'n8n_10B_outlook_mail_source_workflow.json');
    if (fs.existsSync(outlookFile)) {
      const oWf = JSON.parse(fs.readFileSync(outlookFile, 'utf8'));
      oWf.nodes.forEach(node => {
        if (node.name === 'Trigger Common Ingestion Pipeline' && node.parameters?.workflowId) {
          node.parameters.workflowId.value = commonIngestionId;
        }
      });
      fs.writeFileSync(outlookFile, JSON.stringify(oWf, null, 2), 'utf8');
      execSync(`docker exec -i n8n sh -c "cat > /tmp/workflows/n8n_10B_outlook_mail_source_workflow.json"`, {
        input: Buffer.from(JSON.stringify(oWf, null, 2), 'utf8')
      });
      execSync(`docker exec n8n n8n import:workflow --input=/tmp/workflows/n8n_10B_outlook_mail_source_workflow.json --projectId=${PROJECT_ID}`);
      console.log(`Linked 10B Outlook -> 10C Common Ingestion (ID: ${commonIngestionId})`);
    }
  }

  console.log('\nAll Workflows Successfully Imported & Linked in n8n! ✅');
}

importAllWorkflows().catch(console.error);
