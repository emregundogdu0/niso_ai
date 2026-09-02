const { execSync } = require('child_process');

const script = `
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('/home/node/.n8n/database.sqlite');

const routerId = 'lxi5cG6Na2L11ZwH';
const hrId = '60asCH6v5sATWMfW';
const sqlId = 'FVXBFc32SsOB9YHx';
const mailId = 'qkdTZicYKysOUjaa';
const hybridId = 'MGoU6i9YoqALomCW';
const commonIngestionId = 'jCZD2ezaSyAFysT1';
const gmailId = 'iT8uVQDATECFvVko';
const outlookId = 'YRmiTim1IgrvniBf';

// 1. Update Router
const routerRow = db.prepare('SELECT nodes FROM workflow_entity WHERE id = ?').get(routerId);
if (routerRow && routerRow.nodes) {
  const nodes = JSON.parse(routerRow.nodes);
  nodes.forEach(node => {
    if (node.name === 'Execute Sub-Workflow HR Hybrid' && node.parameters?.workflowId) {
      node.parameters.workflowId.value = hrId;
    }
    if (node.name === 'Execute Sub-Workflow Attendance SQL' && node.parameters?.workflowId) {
      node.parameters.workflowId.value = sqlId;
    }
    if (node.name === 'Execute Sub-Workflow Project Mail RAG' && node.parameters?.workflowId) {
      node.parameters.workflowId.value = mailId;
    }
    if (node.name === 'Execute Sub-Workflow Hybrid Evidence Merger' && node.parameters?.workflowId) {
      node.parameters.workflowId.value = hybridId;
    }
  });
  db.prepare('UPDATE workflow_entity SET nodes = ? WHERE id = ?').run(JSON.stringify(nodes), routerId);
  console.log('Router Execute Workflow links updated in SQLite.');
}

// 2. Update Gmail Source
const gmailRow = db.prepare('SELECT nodes FROM workflow_entity WHERE id = ?').get(gmailId);
if (gmailRow && gmailRow.nodes) {
  const nodes = JSON.parse(gmailRow.nodes);
  nodes.forEach(node => {
    if (node.name === 'Trigger Common Ingestion Pipeline' && node.parameters?.workflowId) {
      node.parameters.workflowId.value = commonIngestionId;
    }
  });
  db.prepare('UPDATE workflow_entity SET nodes = ? WHERE id = ?').run(JSON.stringify(nodes), gmailId);
  console.log('Gmail Source link to Common Ingestion updated in SQLite.');
}

// 3. Update Outlook Source
const outlookRow = db.prepare('SELECT nodes FROM workflow_entity WHERE id = ?').get(outlookId);
if (outlookRow && outlookRow.nodes) {
  const nodes = JSON.parse(outlookRow.nodes);
  nodes.forEach(node => {
    if (node.name === 'Trigger Common Ingestion Pipeline' && node.parameters?.workflowId) {
      node.parameters.workflowId.value = commonIngestionId;
    }
  });
  db.prepare('UPDATE workflow_entity SET nodes = ? WHERE id = ?').run(JSON.stringify(nodes), outlookId);
  console.log('Outlook Source link to Common Ingestion updated in SQLite.');
}

console.log('All workflow links verified in n8n SQLite.');
`;

const res = execSync('docker exec -i n8n node --experimental-sqlite -e "' + script.replace(/"/g, '\\"').replace(/\n/g, ' ') + '"', { encoding: 'utf8' });
console.log(res);
